-- =============================================================
-- Leilão na venda
-- A venda operacional pode ser realizada em um leilão. Guardamos o
-- leilão + lote em cada *_sales e passamos a contar/exibir VENDAS
-- (além das COMPRAS) no módulo de Leilões.
-- =============================================================

-- 1) Colunas de leilão nas tabelas de venda
ALTER TABLE public.animal_sales
  ADD COLUMN IF NOT EXISTS auction_id UUID NULL REFERENCES public.leiloes(id),
  ADD COLUMN IF NOT EXISTS auction_lot TEXT NULL;
ALTER TABLE public.pregnancy_sales
  ADD COLUMN IF NOT EXISTS auction_id UUID NULL REFERENCES public.leiloes(id),
  ADD COLUMN IF NOT EXISTS auction_lot TEXT NULL;
ALTER TABLE public.aspiration_sales
  ADD COLUMN IF NOT EXISTS auction_id UUID NULL REFERENCES public.leiloes(id),
  ADD COLUMN IF NOT EXISTS auction_lot TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_animal_sales_auction_id ON public.animal_sales (auction_id) WHERE auction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pregnancy_sales_auction_id ON public.pregnancy_sales (auction_id) WHERE auction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_aspiration_sales_auction_id ON public.aspiration_sales (auction_id) WHERE auction_id IS NOT NULL;

-- 2) RPC de venda operacional passa a receber leilão + lote
DROP FUNCTION IF EXISTS public.register_operational_sale(text, uuid, date, numeric, date, jsonb, jsonb);

CREATE OR REPLACE FUNCTION public.register_operational_sale(
  p_tipo TEXT,
  p_item_id UUID,
  p_sale_date DATE,
  p_total NUMERIC,
  p_data_prevista DATE,
  p_clients JSONB,
  p_owners JSONB DEFAULT '[]'::jsonb,
  p_auction_id UUID DEFAULT NULL,
  p_auction_lot TEXT DEFAULT NULL
)
RETURNS UUID
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

  EXECUTE format('SELECT store_id, name FROM public.%I WHERE id = $1', v_mgmt_table)
    INTO v_store_id, v_nome USING p_item_id;
  IF v_store_id IS NULL THEN
    RAISE EXCEPTION 'Item não encontrado ou sem loja vinculada.';
  END IF;

  -- 1) Insere a venda operacional (1 linha). O trigger existente cria a entrega.
  EXECUTE format(
    'INSERT INTO public.%I (%I, client_id, sale_date, sale_value, sale_percentage, data_prevista_entrega, auction_id, auction_lot, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id',
    v_sales_table, v_sales_fk)
    INTO v_sale_id
    USING p_item_id,
          (p_clients->0->>'cliente_id')::uuid,
          p_sale_date, p_total, v_sum_animal, p_data_prevista, p_auction_id, p_auction_lot, v_uid;

  SELECT id INTO v_entrega_id FROM public.entregas WHERE origem_sale_id = v_sale_id;
  IF v_entrega_id IS NULL THEN
    RAISE EXCEPTION 'Falha ao criar a entrega da venda.';
  END IF;

  -- 3) Clientes da entrega
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

  -- 4) Proprietários atuais (edições do usuário)
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

  -- 5) Cada comprador vira proprietário com sua % do animal
  FOR v_client IN SELECT * FROM jsonb_array_elements(p_clients) LOOP
    v_cid := (v_client->>'cliente_id')::uuid;
    v_pct_animal := NULLIF(v_client->>'percentual_animal','')::numeric;
    IF v_pct_animal IS NULL OR v_pct_animal <= 0 THEN
      CONTINUE;
    END IF;

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

  -- 6) Marca como vendido quando a fazenda própria zera (prenhez/aspiração)
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

-- 3) Visão geral dos leilões: agora conta COMPRAS e VENDAS
DROP FUNCTION IF EXISTS public.list_leiloes_overview(uuid[], uuid, text, date, date, text, text, integer, integer);

CREATE OR REPLACE FUNCTION public.list_leiloes_overview(
  p_store_ids UUID[] DEFAULT NULL,
  p_matrix_id UUID DEFAULT NULL,
  p_name TEXT DEFAULT NULL,
  p_date_from DATE DEFAULT NULL,
  p_date_to DATE DEFAULT NULL,
  p_sort_field TEXT DEFAULT 'date',
  p_sort_direction TEXT DEFAULT 'desc',
  p_page INTEGER DEFAULT 1,
  p_page_size INTEGER DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  code INTEGER,
  name TEXT,
  date DATE,
  city TEXT,
  is_active BOOLEAN,
  observations TEXT,
  attachments JSONB,
  store_id UUID,
  matrix_id UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  animal_count BIGINT,
  pregnancy_count BIGINT,
  aspiration_count BIGINT,
  linked_records_count BIGINT,
  sales_count BIGINT,
  total_count BIGINT
)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_page INTEGER := GREATEST(COALESCE(p_page, 1), 1);
  v_page_size INTEGER := LEAST(GREATEST(COALESCE(p_page_size, 20), 1), 100);
  v_offset INTEGER := (GREATEST(COALESCE(p_page, 1), 1) - 1) * LEAST(GREATEST(COALESCE(p_page_size, 20), 1), 100);
  v_sort_field TEXT := CASE
    WHEN p_sort_field IN ('code', 'name', 'date', 'city', 'linked_records_count', 'sales_count') THEN p_sort_field
    ELSE 'date'
  END;
  v_sort_direction TEXT := CASE
    WHEN LOWER(COALESCE(p_sort_direction, 'desc')) IN ('asc', 'desc') THEN LOWER(COALESCE(p_sort_direction, 'desc'))
    ELSE 'desc'
  END;
  v_name TEXT := NULLIF(BTRIM(p_name), '');
BEGIN
  RETURN QUERY
  WITH filtered AS (
    SELECT l.*
    FROM public.leiloes l
    WHERE l.is_active = true
      AND (p_matrix_id IS NULL OR l.matrix_id = p_matrix_id)
      AND (
        p_matrix_id IS NOT NULL
        OR p_store_ids IS NULL
        OR COALESCE(array_length(p_store_ids, 1), 0) = 0
        OR l.store_id = ANY(p_store_ids)
      )
      AND (v_name IS NULL OR l.name ILIKE '%' || v_name || '%')
      AND (p_date_from IS NULL OR l.date >= p_date_from)
      AND (p_date_to IS NULL OR l.date <= p_date_to)
  ),
  animal_counts AS (
    SELECT a.auction_id, COUNT(*)::BIGINT AS total
    FROM public.animals a INNER JOIN filtered f ON f.id = a.auction_id
    GROUP BY a.auction_id
  ),
  pregnancy_counts AS (
    SELECT p.auction_id, COUNT(*)::BIGINT AS total
    FROM public.pregnancy_management p INNER JOIN filtered f ON f.id = p.auction_id
    GROUP BY p.auction_id
  ),
  aspiration_counts AS (
    SELECT a.auction_id, COUNT(*)::BIGINT AS total
    FROM public.aspiration_management a INNER JOIN filtered f ON f.id = a.auction_id
    GROUP BY a.auction_id
  ),
  animal_sale_counts AS (
    SELECT s.auction_id, COUNT(*)::BIGINT AS total
    FROM public.animal_sales s INNER JOIN filtered f ON f.id = s.auction_id
    GROUP BY s.auction_id
  ),
  pregnancy_sale_counts AS (
    SELECT s.auction_id, COUNT(*)::BIGINT AS total
    FROM public.pregnancy_sales s INNER JOIN filtered f ON f.id = s.auction_id
    GROUP BY s.auction_id
  ),
  aspiration_sale_counts AS (
    SELECT s.auction_id, COUNT(*)::BIGINT AS total
    FROM public.aspiration_sales s INNER JOIN filtered f ON f.id = s.auction_id
    GROUP BY s.auction_id
  ),
  counted AS (
    SELECT
      f.id, f.code, f.name, f.date, f.city, f.is_active, f.observations, f.attachments,
      f.store_id, f.matrix_id, f.created_at, f.updated_at,
      COALESCE(ac.total, 0) AS animal_count,
      COALESCE(pc.total, 0) AS pregnancy_count,
      COALESCE(ascn.total, 0) AS aspiration_count,
      COALESCE(ac.total, 0) + COALESCE(pc.total, 0) + COALESCE(ascn.total, 0) AS linked_records_count,
      COALESCE(asc1.total, 0) + COALESCE(psc.total, 0) + COALESCE(spc.total, 0) AS sales_count
    FROM filtered f
    LEFT JOIN animal_counts ac ON ac.auction_id = f.id
    LEFT JOIN pregnancy_counts pc ON pc.auction_id = f.id
    LEFT JOIN aspiration_counts ascn ON ascn.auction_id = f.id
    LEFT JOIN animal_sale_counts asc1 ON asc1.auction_id = f.id
    LEFT JOIN pregnancy_sale_counts psc ON psc.auction_id = f.id
    LEFT JOIN aspiration_sale_counts spc ON spc.auction_id = f.id
  ),
  total AS (
    SELECT COUNT(*)::BIGINT AS total_count FROM filtered
  )
  SELECT
    c.id, c.code, c.name, c.date, c.city, c.is_active, c.observations, c.attachments,
    c.store_id, c.matrix_id, c.created_at, c.updated_at,
    c.animal_count, c.pregnancy_count, c.aspiration_count, c.linked_records_count, c.sales_count,
    t.total_count
  FROM counted c
  CROSS JOIN total t
  ORDER BY
    CASE WHEN v_sort_field = 'code' AND v_sort_direction = 'asc' THEN c.code END ASC NULLS LAST,
    CASE WHEN v_sort_field = 'code' AND v_sort_direction = 'desc' THEN c.code END DESC NULLS LAST,
    CASE WHEN v_sort_field = 'name' AND v_sort_direction = 'asc' THEN LOWER(c.name) END ASC NULLS LAST,
    CASE WHEN v_sort_field = 'name' AND v_sort_direction = 'desc' THEN LOWER(c.name) END DESC NULLS LAST,
    CASE WHEN v_sort_field = 'date' AND v_sort_direction = 'asc' THEN c.date END ASC NULLS LAST,
    CASE WHEN v_sort_field = 'date' AND v_sort_direction = 'desc' THEN c.date END DESC NULLS LAST,
    CASE WHEN v_sort_field = 'city' AND v_sort_direction = 'asc' THEN LOWER(c.city) END ASC NULLS LAST,
    CASE WHEN v_sort_field = 'city' AND v_sort_direction = 'desc' THEN LOWER(c.city) END DESC NULLS LAST,
    CASE WHEN v_sort_field = 'linked_records_count' AND v_sort_direction = 'asc' THEN c.linked_records_count END ASC NULLS LAST,
    CASE WHEN v_sort_field = 'linked_records_count' AND v_sort_direction = 'desc' THEN c.linked_records_count END DESC NULLS LAST,
    CASE WHEN v_sort_field = 'sales_count' AND v_sort_direction = 'asc' THEN c.sales_count END ASC NULLS LAST,
    CASE WHEN v_sort_field = 'sales_count' AND v_sort_direction = 'desc' THEN c.sales_count END DESC NULLS LAST,
    c.date DESC,
    c.code DESC
  OFFSET v_offset
  LIMIT v_page_size;
END;
$$;

-- 4) Proteção de exclusão considera também as vendas vinculadas
CREATE OR REPLACE FUNCTION public.prevent_delete_leilao_with_links()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_linked_count BIGINT := 0;
BEGIN
  SELECT
    COALESCE((SELECT COUNT(*) FROM public.animals a WHERE a.auction_id = OLD.id), 0) +
    COALESCE((SELECT COUNT(*) FROM public.pregnancy_management p WHERE p.auction_id = OLD.id), 0) +
    COALESCE((SELECT COUNT(*) FROM public.aspiration_management am WHERE am.auction_id = OLD.id), 0) +
    COALESCE((SELECT COUNT(*) FROM public.animal_sales s WHERE s.auction_id = OLD.id), 0) +
    COALESCE((SELECT COUNT(*) FROM public.pregnancy_sales s WHERE s.auction_id = OLD.id), 0) +
    COALESCE((SELECT COUNT(*) FROM public.aspiration_sales s WHERE s.auction_id = OLD.id), 0)
  INTO v_linked_count;

  IF v_linked_count > 0 THEN
    RAISE EXCEPTION 'Este leilão não pode ser excluído porque possui cadastros ou vendas vinculados.';
  END IF;

  RETURN OLD;
END;
$$;
