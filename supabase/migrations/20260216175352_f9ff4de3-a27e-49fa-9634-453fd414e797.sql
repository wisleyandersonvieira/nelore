
-- Add ultrasound_date to embryo_transfer_management
ALTER TABLE public.embryo_transfer_management 
ADD COLUMN IF NOT EXISTS ultrasound_date date;

-- Add reproduction data columns to pregnancy_management
ALTER TABLE public.pregnancy_management 
ADD COLUMN IF NOT EXISTS aspiration_date date,
ADD COLUMN IF NOT EXISTS transfer_date date,
ADD COLUMN IF NOT EXISTS veterinarian_id uuid REFERENCES public.veterinarians(id),
ADD COLUMN IF NOT EXISTS laboratory_id uuid REFERENCES public.laboratories(id),
ADD COLUMN IF NOT EXISTS ultrasound_date date;
