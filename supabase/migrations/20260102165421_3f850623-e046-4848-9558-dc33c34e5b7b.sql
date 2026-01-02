-- Create animals table for animal registration
CREATE TABLE public.animals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code INTEGER NOT NULL,
  name TEXT NOT NULL,
  registration TEXT,
  ear_tag INTEGER,
  batch_id UUID REFERENCES public.animal_batches(id),
  sex TEXT NOT NULL CHECK (sex IN ('macho', 'femea')),
  farm_entry_date DATE,
  birth_date DATE,
  first_weighing_date DATE,
  first_weight NUMERIC,
  breed_id UUID REFERENCES public.animal_breeds(id),
  category_id UUID REFERENCES public.animal_categories(id),
  auction_id UUID REFERENCES public.leiloes(id),
  auction_lot TEXT,
  sire_id UUID REFERENCES public.breeding_animals(id),
  dam_id UUID REFERENCES public.breeding_animals(id),
  observations TEXT,
  photos JSONB DEFAULT '[]'::jsonb,
  cover_photo TEXT,
  store_id UUID NOT NULL REFERENCES public.stores(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_animal_name_per_store UNIQUE (name, store_id)
);

-- Enable RLS
ALTER TABLE public.animals ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view animals for their store"
ON public.animals FOR SELECT
USING ((get_user_role() = 'admin'::user_role) OR (store_id = get_user_store_id()));

CREATE POLICY "Users can create animals for their store"
ON public.animals FOR INSERT
WITH CHECK ((get_user_role() = 'admin'::user_role) OR (store_id = get_user_store_id()));

CREATE POLICY "Users can update animals for their store"
ON public.animals FOR UPDATE
USING ((get_user_role() = 'admin'::user_role) OR (store_id = get_user_store_id()));

CREATE POLICY "Users can delete animals for their store"
ON public.animals FOR DELETE
USING ((get_user_role() = 'admin'::user_role) OR (store_id = get_user_store_id()));

-- Function to get next animal code
CREATE OR REPLACE FUNCTION public.get_next_animal_code(store_uuid UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  next_code INTEGER;
BEGIN
  SELECT COALESCE(MAX(code), 0) + 1 INTO next_code
  FROM public.animals
  WHERE store_id = store_uuid;
  RETURN next_code;
END;
$$;

-- Trigger for updated_at
CREATE TRIGGER update_animals_updated_at
BEFORE UPDATE ON public.animals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for animal photos
INSERT INTO storage.buckets (id, name, public) VALUES ('animal-photos', 'animal-photos', true);

-- Storage policies for animal photos
CREATE POLICY "Anyone can view animal photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'animal-photos');

CREATE POLICY "Authenticated users can upload animal photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'animal-photos' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update animal photos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'animal-photos' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete animal photos"
ON storage.objects FOR DELETE
USING (bucket_id = 'animal-photos' AND auth.role() = 'authenticated');