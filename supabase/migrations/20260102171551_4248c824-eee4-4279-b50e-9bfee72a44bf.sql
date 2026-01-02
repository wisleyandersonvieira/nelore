-- Add genealogy fields to breeding_animals table
ALTER TABLE public.breeding_animals
ADD COLUMN sire_id uuid REFERENCES public.breeding_animals(id) ON DELETE SET NULL,
ADD COLUMN dam_id uuid REFERENCES public.breeding_animals(id) ON DELETE SET NULL;

-- Add comments for clarity
COMMENT ON COLUMN public.breeding_animals.sire_id IS 'Reference to the sire (father) breeding animal';
COMMENT ON COLUMN public.breeding_animals.dam_id IS 'Reference to the dam (mother) breeding animal';