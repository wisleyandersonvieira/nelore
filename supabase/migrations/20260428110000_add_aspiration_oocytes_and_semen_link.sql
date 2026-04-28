ALTER TABLE public.aspiration_management
  ADD COLUMN IF NOT EXISTS observations TEXT,
  ADD COLUMN IF NOT EXISTS oocyte_count INTEGER;

ALTER TABLE public.aspiration_management
  DROP CONSTRAINT IF EXISTS aspiration_management_oocyte_count_check;

ALTER TABLE public.aspiration_management
  ADD CONSTRAINT aspiration_management_oocyte_count_check
  CHECK (oocyte_count IS NULL OR oocyte_count >= 0);

ALTER TABLE public.semen_utilizations
  ADD COLUMN IF NOT EXISTS aspiration_id UUID REFERENCES public.aspiration_management(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_semen_utilizations_aspiration_id
  ON public.semen_utilizations(aspiration_id);
