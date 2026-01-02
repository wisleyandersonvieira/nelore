-- Create table for breeding animals (matrizes & genitores)
CREATE TABLE public.breeding_animals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  sex TEXT NOT NULL CHECK (sex IN ('macho', 'femea')),
  registration TEXT,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for store_id
CREATE INDEX idx_breeding_animals_store_id ON public.breeding_animals(store_id);

-- Create unique index for name per store
CREATE UNIQUE INDEX idx_breeding_animals_name_store ON public.breeding_animals(name, store_id);

-- Enable RLS
ALTER TABLE public.breeding_animals ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view breeding animals for their store"
ON public.breeding_animals
FOR SELECT
USING (
  (get_user_role() = 'admin'::user_role) OR (store_id = get_user_store_id())
);

CREATE POLICY "Users can create breeding animals for their store"
ON public.breeding_animals
FOR INSERT
WITH CHECK (
  (get_user_role() = 'admin'::user_role) OR (store_id = get_user_store_id())
);

CREATE POLICY "Users can update breeding animals for their store"
ON public.breeding_animals
FOR UPDATE
USING (
  (get_user_role() = 'admin'::user_role) OR (store_id = get_user_store_id())
);

CREATE POLICY "Users can delete breeding animals for their store"
ON public.breeding_animals
FOR DELETE
USING (
  (get_user_role() = 'admin'::user_role) OR (store_id = get_user_store_id())
);

-- Trigger for updated_at
CREATE TRIGGER update_breeding_animals_updated_at
BEFORE UPDATE ON public.breeding_animals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();