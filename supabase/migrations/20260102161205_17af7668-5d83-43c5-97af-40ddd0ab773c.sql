
-- Create animal_breeds table
CREATE TABLE public.animal_breeds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code INTEGER NOT NULL,
  name TEXT NOT NULL,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(code, store_id),
  UNIQUE(name, store_id)
);

-- Create animal_categories table
CREATE TABLE public.animal_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code INTEGER NOT NULL,
  name TEXT NOT NULL,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(code, store_id),
  UNIQUE(name, store_id)
);

-- Create indexes
CREATE INDEX idx_animal_breeds_store_id ON public.animal_breeds(store_id);
CREATE INDEX idx_animal_categories_store_id ON public.animal_categories(store_id);

-- Enable RLS
ALTER TABLE public.animal_breeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.animal_categories ENABLE ROW LEVEL SECURITY;

-- RLS policies for animal_breeds
CREATE POLICY "Users can view animal breeds for their store"
  ON public.animal_breeds FOR SELECT
  USING ((get_user_role() = 'admin'::user_role) OR (store_id = get_user_store_id()));

CREATE POLICY "Users can create animal breeds for their store"
  ON public.animal_breeds FOR INSERT
  WITH CHECK ((get_user_role() = 'admin'::user_role) OR (store_id = get_user_store_id()));

CREATE POLICY "Users can update animal breeds for their store"
  ON public.animal_breeds FOR UPDATE
  USING ((get_user_role() = 'admin'::user_role) OR (store_id = get_user_store_id()));

CREATE POLICY "Users can delete animal breeds for their store"
  ON public.animal_breeds FOR DELETE
  USING ((get_user_role() = 'admin'::user_role) OR (store_id = get_user_store_id()));

-- RLS policies for animal_categories
CREATE POLICY "Users can view animal categories for their store"
  ON public.animal_categories FOR SELECT
  USING ((get_user_role() = 'admin'::user_role) OR (store_id = get_user_store_id()));

CREATE POLICY "Users can create animal categories for their store"
  ON public.animal_categories FOR INSERT
  WITH CHECK ((get_user_role() = 'admin'::user_role) OR (store_id = get_user_store_id()));

CREATE POLICY "Users can update animal categories for their store"
  ON public.animal_categories FOR UPDATE
  USING ((get_user_role() = 'admin'::user_role) OR (store_id = get_user_store_id()));

CREATE POLICY "Users can delete animal categories for their store"
  ON public.animal_categories FOR DELETE
  USING ((get_user_role() = 'admin'::user_role) OR (store_id = get_user_store_id()));

-- Functions to get next code
CREATE OR REPLACE FUNCTION public.get_next_animal_breed_code(store_uuid uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  next_code INTEGER;
BEGIN
  SELECT COALESCE(MAX(code), 0) + 1 INTO next_code
  FROM public.animal_breeds
  WHERE store_id = store_uuid;
  RETURN next_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_next_animal_category_code(store_uuid uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  next_code INTEGER;
BEGIN
  SELECT COALESCE(MAX(code), 0) + 1 INTO next_code
  FROM public.animal_categories
  WHERE store_id = store_uuid;
  RETURN next_code;
END;
$$;

-- Triggers for updated_at
CREATE TRIGGER update_animal_breeds_updated_at
  BEFORE UPDATE ON public.animal_breeds
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_animal_categories_updated_at
  BEFORE UPDATE ON public.animal_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
