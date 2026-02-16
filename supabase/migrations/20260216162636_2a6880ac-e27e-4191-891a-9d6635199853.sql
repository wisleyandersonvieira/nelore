
-- Add new columns to aspiration_management for the finalization workflow
ALTER TABLE public.aspiration_management 
  ADD COLUMN aspiration_date date,
  ADD COLUMN laboratory_id uuid REFERENCES public.laboratories(id),
  ADD COLUMN veterinarian_id uuid REFERENCES public.veterinarians(id),
  ADD COLUMN embryo_count integer,
  ADD COLUMN embryo_details jsonb;

-- Change default status from 'in_progress' to 'pending'
ALTER TABLE public.aspiration_management 
  ALTER COLUMN status SET DEFAULT 'pending';

-- Update existing 'in_progress' records that haven't been finalized to 'pending' if needed
-- (keeping existing data as-is since they were already created)
