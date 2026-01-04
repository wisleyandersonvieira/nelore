-- Add recipient_id column to pregnancy_management table
ALTER TABLE public.pregnancy_management 
ADD COLUMN recipient_id UUID REFERENCES public.animals(id);