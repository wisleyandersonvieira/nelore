
-- Laboratórios
CREATE TABLE public.laboratories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code INTEGER NOT NULL,
  name TEXT NOT NULL,
  city TEXT,
  state TEXT,
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  observations TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  store_id UUID NOT NULL REFERENCES public.stores(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.laboratories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view laboratories from their stores" ON public.laboratories
  FOR SELECT USING (public.user_has_access_to_store(store_id));

CREATE POLICY "Users can insert laboratories" ON public.laboratories
  FOR INSERT WITH CHECK (public.user_has_access_to_store(store_id));

CREATE POLICY "Users can update laboratories" ON public.laboratories
  FOR UPDATE USING (public.user_has_access_to_store(store_id));

CREATE POLICY "Users can delete laboratories" ON public.laboratories
  FOR DELETE USING (public.user_has_access_to_store(store_id));

CREATE OR REPLACE FUNCTION public.get_next_laboratory_code(store_uuid uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE next_code INTEGER;
BEGIN
  SELECT COALESCE(MAX(code), 0) + 1 INTO next_code FROM public.laboratories WHERE store_id = store_uuid;
  RETURN next_code;
END;
$$;

-- Veterinários
CREATE TABLE public.veterinarians (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code INTEGER NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  city TEXT,
  state TEXT,
  email TEXT,
  observations TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  store_id UUID NOT NULL REFERENCES public.stores(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.veterinarians ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view veterinarians from their stores" ON public.veterinarians
  FOR SELECT USING (public.user_has_access_to_store(store_id));

CREATE POLICY "Users can insert veterinarians" ON public.veterinarians
  FOR INSERT WITH CHECK (public.user_has_access_to_store(store_id));

CREATE POLICY "Users can update veterinarians" ON public.veterinarians
  FOR UPDATE USING (public.user_has_access_to_store(store_id));

CREATE POLICY "Users can delete veterinarians" ON public.veterinarians
  FOR DELETE USING (public.user_has_access_to_store(store_id));

CREATE OR REPLACE FUNCTION public.get_next_veterinarian_code(store_uuid uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE next_code INTEGER;
BEGIN
  SELECT COALESCE(MAX(code), 0) + 1 INTO next_code FROM public.veterinarians WHERE store_id = store_uuid;
  RETURN next_code;
END;
$$;
