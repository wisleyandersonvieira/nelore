ALTER TABLE public.aspiration_batch_utilizations
  ADD COLUMN IF NOT EXISTS oocyte_count INTEGER;

ALTER TABLE public.aspiration_batch_utilizations
  DROP CONSTRAINT IF EXISTS aspiration_batch_utilizations_oocyte_count_check;

ALTER TABLE public.aspiration_batch_utilizations
  ADD CONSTRAINT aspiration_batch_utilizations_oocyte_count_check
  CHECK (oocyte_count IS NULL OR oocyte_count >= 0);

ALTER TABLE public.semen_utilizations
  ADD COLUMN IF NOT EXISTS batch_utilization_id UUID REFERENCES public.aspiration_batch_utilizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_semen_utilizations_batch_utilization_id
  ON public.semen_utilizations(batch_utilization_id);

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
    oocyte_count = v_latest.oocyte_count,
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
