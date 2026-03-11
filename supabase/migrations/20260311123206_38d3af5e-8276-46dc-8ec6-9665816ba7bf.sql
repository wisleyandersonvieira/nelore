
-- Add matrix_id to animal_breeds
ALTER TABLE public.animal_breeds ADD COLUMN IF NOT EXISTS matrix_id uuid REFERENCES public.matrices(id);

-- Add matrix_id to animal_categories
ALTER TABLE public.animal_categories ADD COLUMN IF NOT EXISTS matrix_id uuid REFERENCES public.matrices(id);

-- Add matrix_id to leiloes
ALTER TABLE public.leiloes ADD COLUMN IF NOT EXISTS matrix_id uuid REFERENCES public.matrices(id);

-- Add matrix_id to laboratories
ALTER TABLE public.laboratories ADD COLUMN IF NOT EXISTS matrix_id uuid REFERENCES public.matrices(id);

-- Add matrix_id to veterinarians
ALTER TABLE public.veterinarians ADD COLUMN IF NOT EXISTS matrix_id uuid REFERENCES public.matrices(id);

-- Add matrix_id to breeding_animals
ALTER TABLE public.breeding_animals ADD COLUMN IF NOT EXISTS matrix_id uuid REFERENCES public.matrices(id);

-- Populate matrix_id from store's matrix for all existing records
UPDATE public.animal_breeds ab
SET matrix_id = s.matrix_id
FROM public.stores s
WHERE ab.store_id = s.id AND ab.matrix_id IS NULL;

UPDATE public.animal_categories ac
SET matrix_id = s.matrix_id
FROM public.stores s
WHERE ac.store_id = s.id AND ac.matrix_id IS NULL;

UPDATE public.leiloes l
SET matrix_id = s.matrix_id
FROM public.stores s
WHERE l.store_id = s.id AND l.matrix_id IS NULL;

UPDATE public.laboratories l
SET matrix_id = s.matrix_id
FROM public.stores s
WHERE l.store_id = s.id AND l.matrix_id IS NULL;

UPDATE public.veterinarians v
SET matrix_id = s.matrix_id
FROM public.stores s
WHERE v.store_id = s.id AND v.matrix_id IS NULL;

UPDATE public.breeding_animals ba
SET matrix_id = s.matrix_id
FROM public.stores s
WHERE ba.store_id = s.id AND ba.matrix_id IS NULL;
