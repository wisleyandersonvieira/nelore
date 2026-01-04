-- Add recipient_id column to animals table for the "Receptora" field
ALTER TABLE public.animals 
ADD COLUMN recipient_id UUID REFERENCES public.animals(id);

-- Add comment for documentation
COMMENT ON COLUMN public.animals.recipient_id IS 'Reference to the recipient animal (Receptora)';