-- =============================================================
-- Módulo ENTREGA
-- Controle operacional das vendas realizadas (animais, prenhezes e
-- aspirações): acompanha se o item foi entregue, mantido na fazenda
-- própria ou pendente, e se a venda já foi faturada no Comercial.
-- =============================================================

CREATE TABLE public.entregas (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    code INTEGER NOT NULL,
    -- Cliente (mesmo padrão das vendas: tabela suppliers)
    cliente_id UUID NULL REFERENCES public.suppliers(id),
    cliente_nome TEXT NULL,
    -- Item vendido
    tipo_item TEXT NOT NULL CHECK (tipo_item IN ('animal', 'prenhez', 'aspiracao')),
    registro_id UUID NOT NULL,
    registro_nome TEXT NULL,
    -- Dados da venda de origem
    data_venda DATE NULL,
    valor_venda NUMERIC(12, 2) NULL,
    percentual_venda NUMERIC(5, 2) NULL,
    -- Controle de entrega
    status_entrega TEXT NOT NULL DEFAULT 'nao_entregue'
        CHECK (status_entrega IN ('nao_entregue', 'manter_fazenda_propria', 'entregue')),
    manter_fazenda_propria BOOLEAN NOT NULL DEFAULT false,
    data_entrega DATE NULL,
    observacoes_entrega TEXT NULL,
    -- Controle de faturamento (vínculo com Comercial > Vendas)
    status_faturamento TEXT NOT NULL DEFAULT 'nao_faturado'
        CHECK (status_faturamento IN ('nao_faturado', 'faturado')),
    venda_id UUID NULL REFERENCES public.sales(id) ON DELETE SET NULL,
    -- Rastreabilidade da venda de origem (linha em *_sales)
    origem_sale_id UUID NULL,
    -- Multiusuário
    store_id UUID NOT NULL REFERENCES public.stores(id),
    created_by UUID NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    -- Garante que uma entrega só seja faturada com vínculo de venda e vice-versa
    CONSTRAINT entregas_data_entrega_check
        CHECK (status_entrega <> 'entregue' OR data_entrega IS NOT NULL)
);

ALTER TABLE public.entregas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view entregas records" ON public.entregas FOR SELECT USING (true);
CREATE POLICY "Users can create entregas records" ON public.entregas FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update entregas records" ON public.entregas FOR UPDATE USING (true);
CREATE POLICY "Users can delete entregas records" ON public.entregas FOR DELETE USING (true);

CREATE INDEX idx_entregas_store_id ON public.entregas(store_id);
CREATE INDEX idx_entregas_status_entrega ON public.entregas(status_entrega);
CREATE INDEX idx_entregas_status_faturamento ON public.entregas(status_faturamento);
CREATE INDEX idx_entregas_tipo_item ON public.entregas(tipo_item);
CREATE INDEX idx_entregas_registro_id ON public.entregas(registro_id);
CREATE INDEX idx_entregas_venda_id ON public.entregas(venda_id);

CREATE TRIGGER update_entregas_updated_at
BEFORE UPDATE ON public.entregas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- -------------------------------------------------------------
-- Anexos da entrega (múltiplos arquivos por entrega)
-- -------------------------------------------------------------
CREATE TABLE public.entrega_anexos (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    entrega_id UUID NOT NULL REFERENCES public.entregas(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_type TEXT NULL,
    file_size BIGINT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.entrega_anexos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view entrega_anexos" ON public.entrega_anexos FOR SELECT USING (true);
CREATE POLICY "Users can create entrega_anexos" ON public.entrega_anexos FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can delete entrega_anexos" ON public.entrega_anexos FOR DELETE USING (true);

CREATE INDEX idx_entrega_anexos_entrega_id ON public.entrega_anexos(entrega_id);

-- -------------------------------------------------------------
-- Bucket de storage para anexos da entrega (mesmo padrão de animal-photos)
-- -------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('entrega-anexos', 'entrega-anexos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can view entrega anexos"
ON storage.objects FOR SELECT
USING (bucket_id = 'entrega-anexos');

CREATE POLICY "Authenticated users can upload entrega anexos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'entrega-anexos' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete entrega anexos"
ON storage.objects FOR DELETE
USING (bucket_id = 'entrega-anexos' AND auth.role() = 'authenticated');

-- =============================================================
-- Criação automática da entrega ao registrar uma venda
-- Reaproveita o fluxo atual: cada INSERT em aspiration_sales,
-- pregnancy_sales ou animal_sales gera uma entrega "nao_entregue"
-- e "nao_faturado", sem alterar o comportamento existente.
-- =============================================================

-- Aspiração
CREATE OR REPLACE FUNCTION public.create_entrega_from_aspiration_sale()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store_id UUID;
  v_nome TEXT;
  v_cliente TEXT;
  v_code INTEGER;
BEGIN
  SELECT store_id, name INTO v_store_id, v_nome
    FROM public.aspiration_management WHERE id = NEW.aspiration_id;
  IF v_store_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT name INTO v_cliente FROM public.suppliers WHERE id = NEW.client_id;
  SELECT COALESCE(MAX(code), 0) + 1 INTO v_code FROM public.entregas WHERE store_id = v_store_id;

  INSERT INTO public.entregas (
    code, cliente_id, cliente_nome, tipo_item, registro_id, registro_nome,
    data_venda, valor_venda, percentual_venda, origem_sale_id, store_id, created_by
  ) VALUES (
    v_code, NEW.client_id, v_cliente, 'aspiracao', NEW.aspiration_id, v_nome,
    NEW.sale_date, NEW.sale_value, NEW.sale_percentage, NEW.id, v_store_id, NEW.created_by
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_create_entrega_from_aspiration_sale
AFTER INSERT ON public.aspiration_sales
FOR EACH ROW
EXECUTE FUNCTION public.create_entrega_from_aspiration_sale();

-- Prenhez
CREATE OR REPLACE FUNCTION public.create_entrega_from_pregnancy_sale()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store_id UUID;
  v_nome TEXT;
  v_cliente TEXT;
  v_code INTEGER;
BEGIN
  SELECT store_id, name INTO v_store_id, v_nome
    FROM public.pregnancy_management WHERE id = NEW.pregnancy_id;
  IF v_store_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT name INTO v_cliente FROM public.suppliers WHERE id = NEW.client_id;
  SELECT COALESCE(MAX(code), 0) + 1 INTO v_code FROM public.entregas WHERE store_id = v_store_id;

  INSERT INTO public.entregas (
    code, cliente_id, cliente_nome, tipo_item, registro_id, registro_nome,
    data_venda, valor_venda, percentual_venda, origem_sale_id, store_id, created_by
  ) VALUES (
    v_code, NEW.client_id, v_cliente, 'prenhez', NEW.pregnancy_id, v_nome,
    NEW.sale_date, NEW.sale_value, NEW.sale_percentage, NEW.id, v_store_id, NEW.created_by
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_create_entrega_from_pregnancy_sale
AFTER INSERT ON public.pregnancy_sales
FOR EACH ROW
EXECUTE FUNCTION public.create_entrega_from_pregnancy_sale();

-- Animal
CREATE OR REPLACE FUNCTION public.create_entrega_from_animal_sale()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store_id UUID;
  v_nome TEXT;
  v_cliente TEXT;
  v_code INTEGER;
BEGIN
  SELECT store_id, name INTO v_store_id, v_nome
    FROM public.animals WHERE id = NEW.animal_id;
  IF v_store_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT name INTO v_cliente FROM public.suppliers WHERE id = NEW.client_id;
  SELECT COALESCE(MAX(code), 0) + 1 INTO v_code FROM public.entregas WHERE store_id = v_store_id;

  INSERT INTO public.entregas (
    code, cliente_id, cliente_nome, tipo_item, registro_id, registro_nome,
    data_venda, valor_venda, percentual_venda, origem_sale_id, store_id, created_by
  ) VALUES (
    v_code, NEW.client_id, v_cliente, 'animal', NEW.animal_id, v_nome,
    NEW.sale_date, NEW.sale_value, NEW.sale_percentage, NEW.id, v_store_id, NEW.created_by
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_create_entrega_from_animal_sale
AFTER INSERT ON public.animal_sales
FOR EACH ROW
EXECUTE FUNCTION public.create_entrega_from_animal_sale();
