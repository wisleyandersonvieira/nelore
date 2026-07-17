-- Vincula uma matriz/genitor (breeding_animals) a um animal do rebanho (animals).
-- Relação 1:1 -> uma matriz só pode estar vinculada a um único animal (e vice-versa).
ALTER TABLE public.breeding_animals
  ADD COLUMN IF NOT EXISTS animal_id UUID NULL REFERENCES public.animals(id) ON DELETE SET NULL;

-- Garante que cada animal seja vinculado a no máximo uma matriz/genitor.
CREATE UNIQUE INDEX IF NOT EXISTS idx_breeding_animals_animal_id_unique
  ON public.breeding_animals(animal_id)
  WHERE animal_id IS NOT NULL;
