
-- Add reproduction data columns to animals table
ALTER TABLE public.animals
  ADD COLUMN IF NOT EXISTS aspiration_date date,
  ADD COLUMN IF NOT EXISTS transfer_date date,
  ADD COLUMN IF NOT EXISTS veterinarian_id uuid REFERENCES public.veterinarians(id),
  ADD COLUMN IF NOT EXISTS laboratory_id uuid REFERENCES public.laboratories(id),
  ADD COLUMN IF NOT EXISTS ultrasound_date date;
