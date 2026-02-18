
-- Add pregnancy_id column to animals table to trace financial chain
ALTER TABLE public.animals
ADD COLUMN pregnancy_id uuid REFERENCES public.pregnancy_management(id);

-- Create index for performance
CREATE INDEX idx_animals_pregnancy_id ON public.animals(pregnancy_id);
