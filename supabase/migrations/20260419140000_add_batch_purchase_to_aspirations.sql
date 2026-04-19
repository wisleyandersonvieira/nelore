ALTER TABLE public.aspiration_management
  ADD COLUMN IF NOT EXISTS is_batch_purchase BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS batch_quantity INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.aspiration_management
  DROP CONSTRAINT IF EXISTS aspiration_management_batch_quantity_check;

ALTER TABLE public.aspiration_management
  ADD CONSTRAINT aspiration_management_batch_quantity_check
  CHECK (batch_quantity >= 0);

CREATE TABLE IF NOT EXISTS public.aspiration_batch_utilizations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  aspiration_id UUID NOT NULL REFERENCES public.aspiration_management(id) ON DELETE CASCADE,
  aspiration_date DATE NOT NULL,
  laboratory_id UUID REFERENCES public.laboratories(id),
  quantity_used INTEGER NOT NULL CHECK (quantity_used > 0),
  embryo_count INTEGER NOT NULL DEFAULT 0 CHECK (embryo_count >= 0),
  embryo_details JSONB,
  veterinarian_id UUID REFERENCES public.veterinarians(id),
  transfer_date DATE,
  description TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.aspiration_batch_utilizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view aspiration batch utilizations in their matrix" ON public.aspiration_batch_utilizations;
CREATE POLICY "Users can view aspiration batch utilizations in their matrix"
ON public.aspiration_batch_utilizations
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.aspiration_management am
    WHERE am.id = aspiration_batch_utilizations.aspiration_id
      AND public.store_in_user_matrix(am.store_id)
  )
);

DROP POLICY IF EXISTS "Users can insert aspiration batch utilizations in their matrix" ON public.aspiration_batch_utilizations;
CREATE POLICY "Users can insert aspiration batch utilizations in their matrix"
ON public.aspiration_batch_utilizations
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.aspiration_management am
    WHERE am.id = aspiration_batch_utilizations.aspiration_id
      AND public.store_in_user_matrix(am.store_id)
  )
);

DROP POLICY IF EXISTS "Users can update aspiration batch utilizations in their matrix" ON public.aspiration_batch_utilizations;
CREATE POLICY "Users can update aspiration batch utilizations in their matrix"
ON public.aspiration_batch_utilizations
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.aspiration_management am
    WHERE am.id = aspiration_batch_utilizations.aspiration_id
      AND public.store_in_user_matrix(am.store_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.aspiration_management am
    WHERE am.id = aspiration_batch_utilizations.aspiration_id
      AND public.store_in_user_matrix(am.store_id)
  )
);

DROP POLICY IF EXISTS "Users can delete aspiration batch utilizations in their matrix" ON public.aspiration_batch_utilizations;
CREATE POLICY "Users can delete aspiration batch utilizations in their matrix"
ON public.aspiration_batch_utilizations
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.aspiration_management am
    WHERE am.id = aspiration_batch_utilizations.aspiration_id
      AND public.store_in_user_matrix(am.store_id)
  )
);

CREATE INDEX IF NOT EXISTS idx_aspiration_batch_utilizations_aspiration_id
  ON public.aspiration_batch_utilizations(aspiration_id);

CREATE INDEX IF NOT EXISTS idx_aspiration_batch_utilizations_aspiration_date
  ON public.aspiration_batch_utilizations(aspiration_date DESC);

DROP TRIGGER IF EXISTS update_aspiration_batch_utilizations_updated_at ON public.aspiration_batch_utilizations;
CREATE TRIGGER update_aspiration_batch_utilizations_updated_at
BEFORE UPDATE ON public.aspiration_batch_utilizations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.embryo_transfer_management
  ADD COLUMN IF NOT EXISTS batch_utilization_id UUID REFERENCES public.aspiration_batch_utilizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_embryo_transfer_batch_utilization_id
  ON public.embryo_transfer_management(batch_utilization_id);

CREATE OR REPLACE FUNCTION public.validate_aspiration_batch_record()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_total_used INTEGER;
BEGIN
  NEW.name := BTRIM(COALESCE(NEW.name, ''));

  IF NEW.name = '' THEN
    RAISE EXCEPTION 'O nome da aspiração é obrigatório.';
  END IF;

  IF NEW.is_batch_purchase AND COALESCE(NEW.batch_quantity, 0) <= 0 THEN
    RAISE EXCEPTION 'Quantidade deve ser maior que zero para compra em lote.';
  END IF;

  IF NOT NEW.is_batch_purchase THEN
    NEW.batch_quantity := 0;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.is_batch_purchase THEN
    SELECT COALESCE(SUM(quantity_used), 0)
      INTO v_total_used
    FROM public.aspiration_batch_utilizations
    WHERE aspiration_id = NEW.id;

    IF NEW.batch_quantity < v_total_used THEN
      RAISE EXCEPTION 'Quantidade do lote não pode ser menor que a quantidade já consumida.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_aspiration_batch_record_trigger ON public.aspiration_management;
CREATE TRIGGER validate_aspiration_batch_record_trigger
BEFORE INSERT OR UPDATE ON public.aspiration_management
FOR EACH ROW
EXECUTE FUNCTION public.validate_aspiration_batch_record();

CREATE OR REPLACE FUNCTION public.validate_aspiration_batch_utilization()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_batch_quantity INTEGER;
  v_is_batch_purchase BOOLEAN;
  v_total_other INTEGER;
BEGIN
  IF NEW.aspiration_id IS NULL THEN
    RAISE EXCEPTION 'Aspiração é obrigatória.';
  END IF;

  IF NEW.aspiration_date IS NULL THEN
    RAISE EXCEPTION 'Data da aspiração é obrigatória.';
  END IF;

  IF NEW.quantity_used IS NULL OR NEW.quantity_used <= 0 THEN
    RAISE EXCEPTION 'Quantidade utilizada deve ser maior que zero.';
  END IF;

  SELECT am.batch_quantity, am.is_batch_purchase
    INTO v_batch_quantity, v_is_batch_purchase
  FROM public.aspiration_management am
  WHERE am.id = NEW.aspiration_id
  FOR UPDATE;

  IF v_batch_quantity IS NULL THEN
    RAISE EXCEPTION 'Aspiração informada não foi encontrada.';
  END IF;

  IF NOT v_is_batch_purchase THEN
    RAISE EXCEPTION 'Esta aspiração não está configurada como compra em lote.';
  END IF;

  SELECT COALESCE(SUM(quantity_used), 0)
    INTO v_total_other
  FROM public.aspiration_batch_utilizations abu
  WHERE abu.aspiration_id = NEW.aspiration_id
    AND (TG_OP = 'INSERT' OR abu.id <> NEW.id);

  IF v_total_other + NEW.quantity_used > v_batch_quantity THEN
    RAISE EXCEPTION 'Quantidade utilizada não pode ser maior que o saldo disponível.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_aspiration_batch_utilization_trigger ON public.aspiration_batch_utilizations;
CREATE TRIGGER validate_aspiration_batch_utilization_trigger
BEFORE INSERT OR UPDATE ON public.aspiration_batch_utilizations
FOR EACH ROW
EXECUTE FUNCTION public.validate_aspiration_batch_utilization();

CREATE OR REPLACE FUNCTION public.refresh_aspiration_batch_summary(p_aspiration_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_total_used INTEGER := 0;
  v_batch_quantity INTEGER := 0;
  v_current_status TEXT := 'pending';
  v_latest public.aspiration_batch_utilizations%ROWTYPE;
BEGIN
  SELECT
    COALESCE(am.batch_quantity, 0),
    COALESCE(am.status, 'pending')
    INTO v_batch_quantity, v_current_status
  FROM public.aspiration_management am
  WHERE am.id = p_aspiration_id;

  SELECT COALESCE(SUM(quantity_used), 0)
    INTO v_total_used
  FROM public.aspiration_batch_utilizations
  WHERE aspiration_id = p_aspiration_id;

  SELECT *
    INTO v_latest
  FROM public.aspiration_batch_utilizations
  WHERE aspiration_id = p_aspiration_id
  ORDER BY aspiration_date DESC, created_at DESC
  LIMIT 1;

  UPDATE public.aspiration_management
  SET
    status = CASE
      WHEN v_current_status = 'sold' THEN 'sold'
      WHEN v_total_used <= 0 THEN 'pending'
      WHEN v_batch_quantity > 0 AND v_total_used >= v_batch_quantity THEN 'finalized'
      ELSE 'in_progress'
    END,
    aspiration_date = v_latest.aspiration_date,
    laboratory_id = v_latest.laboratory_id,
    veterinarian_id = v_latest.veterinarian_id,
    embryo_count = CASE
      WHEN v_latest.id IS NULL THEN NULL
      ELSE v_latest.embryo_count
    END,
    embryo_details = v_latest.embryo_details,
    transfer_date = v_latest.transfer_date,
    updated_at = now()
  WHERE id = p_aspiration_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_aspiration_batch_summary()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.refresh_aspiration_batch_summary(COALESCE(NEW.aspiration_id, OLD.aspiration_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS sync_aspiration_batch_summary_trigger ON public.aspiration_batch_utilizations;
CREATE TRIGGER sync_aspiration_batch_summary_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.aspiration_batch_utilizations
FOR EACH ROW
EXECUTE FUNCTION public.sync_aspiration_batch_summary();
