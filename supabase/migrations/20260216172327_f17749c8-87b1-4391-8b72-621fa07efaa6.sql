-- Add reproduction data columns to embryo_transfer_management
ALTER TABLE public.embryo_transfer_management 
  ADD COLUMN aspiration_date date,
  ADD COLUMN transfer_date date,
  ADD COLUMN veterinarian_id uuid REFERENCES public.veterinarians(id),
  ADD COLUMN laboratory_id uuid REFERENCES public.laboratories(id);