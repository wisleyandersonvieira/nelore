-- =============================================================
-- Venda com múltiplos clientes
-- Permite que uma única venda operacional (1 item, 1 entrega) seja
-- dividida entre vários clientes compradores. Cada cliente é faturado
-- individualmente no Comercial > Vendas, gerando 1 venda por cliente.
-- =============================================================

-- -------------------------------------------------------------
-- 1a. Tabela filha: clientes da entrega/venda
-- -------------------------------------------------------------
CREATE TABLE public.entrega_clientes (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    entrega_id UUID NOT NULL REFERENCES public.entregas(id) ON DELETE CASCADE,
    cliente_id UUID NULL REFERENCES public.suppliers(id),
    cliente_nome TEXT NULL,
    -- Divisão do VALOR da venda (soma 100% por entrega)
    percentual_venda NUMERIC(5, 2) NOT NULL,
    valor_venda NUMERIC(12, 2) NOT NULL,
    -- % vendida do animal para este cliente (lógica de DONO)
    percentual_animal NUMERIC(5, 2) NULL,
    -- Faturamento individual
    status_faturamento TEXT NOT NULL DEFAULT 'nao_faturado'
        CHECK (status_faturamento IN ('nao_faturado', 'faturado')),
    venda_id UUID NULL REFERENCES public.sales(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.entrega_clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view entrega_clientes" ON public.entrega_clientes FOR SELECT USING (true);
CREATE POLICY "Users can create entrega_clientes" ON public.entrega_clientes FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update entrega_clientes" ON public.entrega_clientes FOR UPDATE USING (true);
CREATE POLICY "Users can delete entrega_clientes" ON public.entrega_clientes FOR DELETE USING (true);

CREATE INDEX idx_entrega_clientes_entrega_id ON public.entrega_clientes(entrega_id);
CREATE INDEX idx_entrega_clientes_cliente_id ON public.entrega_clientes(cliente_id);
CREATE INDEX idx_entrega_clientes_venda_id ON public.entrega_clientes(venda_id);
CREATE INDEX idx_entrega_clientes_status_faturamento ON public.entrega_clientes(status_faturamento);

CREATE TRIGGER update_entrega_clientes_updated_at
BEFORE UPDATE ON public.entrega_clientes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- -------------------------------------------------------------
-- 1b. Novo status intermediário na entrega-pai
-- -------------------------------------------------------------
ALTER TABLE public.entregas
  DROP CONSTRAINT IF EXISTS entregas_status_faturamento_check;
ALTER TABLE public.entregas
  ADD CONSTRAINT entregas_status_faturamento_check
  CHECK (status_faturamento IN ('nao_faturado', 'parcialmente_faturado', 'faturado'));

-- -------------------------------------------------------------
-- 1c. Recalcula o status de faturamento da entrega-pai
--     sempre que os clientes filhos mudam.
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recalc_entrega_faturamento()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entrega_id UUID;
  v_total INTEGER;
  v_faturados INTEGER;
  v_status TEXT;
  v_venda_id UUID;
BEGIN
  v_entrega_id := COALESCE(NEW.entrega_id, OLD.entrega_id);

  SELECT COUNT(*), COUNT(venda_id)
    INTO v_total, v_faturados
    FROM public.entrega_clientes
    WHERE entrega_id = v_entrega_id;

  IF v_total = 0 THEN
    v_status := 'nao_faturado';
    v_venda_id := NULL;
  ELSIF v_faturados = 0 THEN
    v_status := 'nao_faturado';
    v_venda_id := NULL;
  ELSIF v_faturados = v_total THEN
    v_status := 'faturado';
    SELECT venda_id INTO v_venda_id FROM public.entrega_clientes
      WHERE entrega_id = v_entrega_id AND venda_id IS NOT NULL
      ORDER BY updated_at DESC LIMIT 1;
  ELSE
    v_status := 'parcialmente_faturado';
    v_venda_id := NULL;
  END IF;

  UPDATE public.entregas
    SET status_faturamento = v_status,
        venda_id = v_venda_id
    WHERE id = v_entrega_id;

  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_recalc_entrega_faturamento
AFTER INSERT OR UPDATE OF venda_id, status_faturamento OR DELETE ON public.entrega_clientes
FOR EACH ROW
EXECUTE FUNCTION public.recalc_entrega_faturamento();

-- -------------------------------------------------------------
-- 1d. RPC transacional: cria a venda operacional + entrega + clientes
--     + ajusta proprietários (lógica de DONO), tudo numa transação.
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.register_operational_sale(
  p_tipo TEXT,              -- 'animal' | 'prenhez' | 'aspiracao'
  p_item_id UUID,
  p_sale_date DATE,
  p_total NUMERIC,
  p_data_prevista DATE,
  p_clients JSONB,          -- [{cliente_id, percentual_venda, valor_venda, percentual_animal}]
  p_owners JSONB DEFAULT '[]'::jsonb  -- edições dos proprietários atuais
)
RETURNS UUID                -- id da entrega criada
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sales_table TEXT;
  v_sales_fk TEXT;
  v_owners_table TEXT;
  v_owners_fk TEXT;
  v_mgmt_table TEXT;
  v_store_id UUID;
  v_nome TEXT;
  v_sale_id UUID;
  v_entrega_id UUID;
  v_uid UUID := auth.uid();
  v_sum_valor NUMERIC := 0;
  v_sum_pct NUMERIC := 0;
  v_sum_animal NUMERIC := 0;
  v_count INTEGER := 0;
  v_client JSONB;
  v_owner JSONB;
  v_cid UUID;
  v_pct_animal NUMERIC;
  v_otype TEXT;
  v_where TEXT;
  v_existing_id UUID;
  v_existing_pct NUMERIC;
  v_store_has_ownership BOOLEAN;
BEGIN
  -- Resolve as tabelas conforme o tipo
  IF p_tipo = 'animal' THEN
    v_sales_table := 'animal_sales'; v_sales_fk := 'animal_id';
    v_owners_table := 'animal_owners'; v_owners_fk := 'animal_id';
    v_mgmt_table := 'animals';
  ELSIF p_tipo = 'prenhez' THEN
    v_sales_table := 'pregnancy_sales'; v_sales_fk := 'pregnancy_id';
    v_owners_table := 'pregnancy_owners'; v_owners_fk := 'pregnancy_id';
    v_mgmt_table := 'pregnancy_management';
  ELSIF p_tipo = 'aspiracao' THEN
    v_sales_table := 'aspiration_sales'; v_sales_fk := 'aspiration_id';
    v_owners_table := 'aspiration_owners'; v_owners_fk := 'aspiration_id';
    v_mgmt_table := 'aspiration_management';
  ELSE
    RAISE EXCEPTION 'Tipo inválido: %', p_tipo;
  END IF;

  -- Validações dos clientes
  IF p_clients IS NULL OR jsonb_array_length(p_clients) = 0 THEN
    RAISE EXCEPTION 'A venda precisa de ao menos um cliente.';
  END IF;

  FOR v_client IN SELECT * FROM jsonb_array_elements(p_clients) LOOP
    v_count := v_count + 1;
    v_sum_valor := v_sum_valor + COALESCE((v_client->>'valor_venda')::numeric, 0);
    v_sum_pct := v_sum_pct + COALESCE((v_client->>'percentual_venda')::numeric, 0);
    v_sum_animal := v_sum_animal + COALESCE(NULLIF(v_client->>'percentual_animal','')::numeric, 0);
  END LOOP;

  IF ABS(v_sum_valor - p_total) > 0.01 THEN
    RAISE EXCEPTION 'A soma dos valores dos clientes (%) difere do valor total da venda (%).', v_sum_valor, p_total;
  END IF;
  IF ABS(v_sum_pct - 100) > 0.01 THEN
    RAISE EXCEPTION 'A soma dos percentuais da venda precisa totalizar 100%% (atual: %).', v_sum_pct;
  END IF;
  IF v_sum_animal <= 0 OR v_sum_animal > 100 THEN
    RAISE EXCEPTION 'A soma das porcentagens vendidas do animal deve ser maior que 0 e no máximo 100%% (atual: %).', v_sum_animal;
  END IF;

  -- Dados do item (store + nome)
  EXECUTE format('SELECT store_id, name FROM public.%I WHERE id = $1', v_mgmt_table)
    INTO v_store_id, v_nome USING p_item_id;
  IF v_store_id IS NULL THEN
    RAISE EXCEPTION 'Item não encontrado ou sem loja vinculada.';
  END IF;

  -- 1) Insere a venda operacional (1 linha). O trigger existente cria a entrega.
  EXECUTE format(
    'INSERT INTO public.%I (%I, client_id, sale_date, sale_value, sale_percentage, data_prevista_entrega, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
    v_sales_table, v_sales_fk)
    INTO v_sale_id
    USING p_item_id,
          (p_clients->0->>'cliente_id')::uuid,
          p_sale_date, p_total, v_sum_animal, p_data_prevista, v_uid;

  -- 2) Recupera a entrega criada pelo trigger
  SELECT id INTO v_entrega_id FROM public.entregas WHERE origem_sale_id = v_sale_id;
  IF v_entrega_id IS NULL THEN
    RAISE EXCEPTION 'Falha ao criar a entrega da venda.';
  END IF;

  -- 3) Insere os clientes da entrega
  FOR v_client IN SELECT * FROM jsonb_array_elements(p_clients) LOOP
    v_cid := (v_client->>'cliente_id')::uuid;
    INSERT INTO public.entrega_clientes (
      entrega_id, cliente_id, cliente_nome, percentual_venda, valor_venda, percentual_animal
    ) VALUES (
      v_entrega_id, v_cid,
      (SELECT name FROM public.suppliers WHERE id = v_cid),
      (v_client->>'percentual_venda')::numeric,
      (v_client->>'valor_venda')::numeric,
      NULLIF(v_client->>'percentual_animal','')::numeric
    );
  END LOOP;

  -- 4) Ajusta os proprietários atuais (edições do usuário)
  FOR v_owner IN SELECT * FROM jsonb_array_elements(p_owners) LOOP
    v_otype := COALESCE(v_owner->>'owner_type', 'supplier');
    IF v_otype = 'store' AND (v_owner->>'store_owner_id') IS NOT NULL THEN
      v_where := format('%I = $1 AND owner_type = ''store'' AND store_owner_id = %L', v_owners_fk, (v_owner->>'store_owner_id')::uuid);
    ELSIF v_otype = 'third_party_farm' AND (v_owner->>'third_party_farm_id') IS NOT NULL THEN
      v_where := format('%I = $1 AND owner_type = ''third_party_farm'' AND third_party_farm_id = %L', v_owners_fk, (v_owner->>'third_party_farm_id')::uuid);
    ELSE
      v_where := format('%I = $1 AND owner_id = %L', v_owners_fk, (v_owner->>'owner_id')::uuid);
    END IF;

    IF COALESCE((v_owner->>'percentage')::numeric, 0) <= 0 THEN
      EXECUTE format('DELETE FROM public.%I WHERE %s', v_owners_table, v_where) USING p_item_id;
    ELSE
      EXECUTE format('UPDATE public.%I SET percentage = %L WHERE %s', v_owners_table, (v_owner->>'percentage')::numeric, v_where) USING p_item_id;
    END IF;
  END LOOP;

  -- 5) Adiciona/atualiza cada comprador como proprietário com sua % do animal
  FOR v_client IN SELECT * FROM jsonb_array_elements(p_clients) LOOP
    v_cid := (v_client->>'cliente_id')::uuid;
    v_pct_animal := NULLIF(v_client->>'percentual_animal','')::numeric;
    IF v_pct_animal IS NULL OR v_pct_animal <= 0 THEN
      CONTINUE;
    END IF;

    -- Se o comprador já foi tratado no bloco de proprietários editados, não soma de novo
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_owners) o
      WHERE COALESCE(o->>'owner_type', 'supplier') = 'supplier'
        AND (o->>'owner_id')::uuid = v_cid
    ) THEN
      CONTINUE;
    END IF;

    EXECUTE format('SELECT id, percentage FROM public.%I WHERE %I = $1 AND owner_id = $2', v_owners_table, v_owners_fk)
      INTO v_existing_id, v_existing_pct USING p_item_id, v_cid;

    IF v_existing_id IS NOT NULL THEN
      EXECUTE format('UPDATE public.%I SET percentage = $1 WHERE id = $2', v_owners_table)
        USING (COALESCE(v_existing_pct, 0) + v_pct_animal), v_existing_id;
    ELSE
      EXECUTE format('INSERT INTO public.%I (%I, owner_id, owner_type, percentage, created_by) VALUES ($1, $2, ''supplier'', $3, $4)', v_owners_table, v_owners_fk)
        USING p_item_id, v_cid, v_pct_animal, v_uid;
    END IF;
  END LOOP;

  -- 6) Marca o item como vendido quando a fazenda própria zera (prenhez/aspiração)
  IF p_tipo IN ('prenhez', 'aspiracao') THEN
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I WHERE %I = $1 AND owner_type = ''store'' AND percentage > 0)', v_owners_table, v_owners_fk)
      INTO v_store_has_ownership USING p_item_id;
    IF NOT v_store_has_ownership THEN
      EXECUTE format('UPDATE public.%I SET status = ''sold'' WHERE id = $1', v_mgmt_table) USING p_item_id;
    END IF;
  END IF;

  RETURN v_entrega_id;
END;
$$;

-- -------------------------------------------------------------
-- 1e. Compatibilidade: popula entrega_clientes para entregas antigas
-- -------------------------------------------------------------
INSERT INTO public.entrega_clientes (
  entrega_id, cliente_id, cliente_nome, percentual_venda, valor_venda,
  percentual_animal, status_faturamento, venda_id
)
SELECT
  e.id, e.cliente_id, e.cliente_nome, 100, COALESCE(e.valor_venda, 0),
  e.percentual_venda,
  CASE WHEN e.venda_id IS NOT NULL OR e.status_faturamento = 'faturado' THEN 'faturado' ELSE 'nao_faturado' END,
  e.venda_id
FROM public.entregas e
WHERE NOT EXISTS (
  SELECT 1 FROM public.entrega_clientes ec WHERE ec.entrega_id = e.id
);
