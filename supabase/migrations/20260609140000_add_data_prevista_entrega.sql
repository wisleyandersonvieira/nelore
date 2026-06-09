-- =============================================================
-- Adiciona "Data prevista de entrega" ao fluxo de venda/entrega.
-- Campo opcional (NULL) para não afetar registros antigos.
-- =============================================================

-- 1) Coluna no módulo de Entregas
ALTER TABLE public.entregas
  ADD COLUMN IF NOT EXISTS data_prevista_entrega DATE NULL;

CREATE INDEX IF NOT EXISTS idx_entregas_data_prevista_entrega
  ON public.entregas(data_prevista_entrega);

-- 2) Coluna nas tabelas de venda de origem (preenchida pela modal de venda)
ALTER TABLE public.aspiration_sales
  ADD COLUMN IF NOT EXISTS data_prevista_entrega DATE NULL;
ALTER TABLE public.pregnancy_sales
  ADD COLUMN IF NOT EXISTS data_prevista_entrega DATE NULL;
ALTER TABLE public.animal_sales
  ADD COLUMN IF NOT EXISTS data_prevista_entrega DATE NULL;

-- 3) Triggers de criação automática da entrega passam a copiar a data prevista
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
    data_venda, valor_venda, percentual_venda, data_prevista_entrega,
    origem_sale_id, store_id, created_by
  ) VALUES (
    v_code, NEW.client_id, v_cliente, 'aspiracao', NEW.aspiration_id, v_nome,
    NEW.sale_date, NEW.sale_value, NEW.sale_percentage, NEW.data_prevista_entrega,
    NEW.id, v_store_id, NEW.created_by
  );
  RETURN NEW;
END;
$$;

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
    data_venda, valor_venda, percentual_venda, data_prevista_entrega,
    origem_sale_id, store_id, created_by
  ) VALUES (
    v_code, NEW.client_id, v_cliente, 'prenhez', NEW.pregnancy_id, v_nome,
    NEW.sale_date, NEW.sale_value, NEW.sale_percentage, NEW.data_prevista_entrega,
    NEW.id, v_store_id, NEW.created_by
  );
  RETURN NEW;
END;
$$;

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
    data_venda, valor_venda, percentual_venda, data_prevista_entrega,
    origem_sale_id, store_id, created_by
  ) VALUES (
    v_code, NEW.client_id, v_cliente, 'animal', NEW.animal_id, v_nome,
    NEW.sale_date, NEW.sale_value, NEW.sale_percentage, NEW.data_prevista_entrega,
    NEW.id, v_store_id, NEW.created_by
  );
  RETURN NEW;
END;
$$;
