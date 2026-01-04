-- Create table for third party farms
CREATE TABLE public.third_party_farms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code INTEGER NOT NULL,
  name TEXT NOT NULL,
  city TEXT,
  owner TEXT,
  phone TEXT,
  store_id UUID NOT NULL REFERENCES public.stores(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.third_party_farms ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view third party farms for their store"
ON public.third_party_farms
FOR SELECT
USING ((get_user_role() = 'admin'::user_role) OR (store_id = get_user_store_id()));

CREATE POLICY "Users can create third party farms for their store"
ON public.third_party_farms
FOR INSERT
WITH CHECK ((get_user_role() = 'admin'::user_role) OR (store_id = get_user_store_id()));

CREATE POLICY "Users can update third party farms for their store"
ON public.third_party_farms
FOR UPDATE
USING ((get_user_role() = 'admin'::user_role) OR (store_id = get_user_store_id()));

CREATE POLICY "Users can delete third party farms for their store"
ON public.third_party_farms
FOR DELETE
USING ((get_user_role() = 'admin'::user_role) OR (store_id = get_user_store_id()));

-- Create function to get next code
CREATE OR REPLACE FUNCTION public.get_next_third_party_farm_code(store_uuid uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  next_code INTEGER;
BEGIN
  SELECT COALESCE(MAX(code), 0) + 1 INTO next_code
  FROM public.third_party_farms
  WHERE store_id = store_uuid;
  RETURN next_code;
END;
$$;

-- Create trigger for updated_at
CREATE TRIGGER update_third_party_farms_updated_at
BEFORE UPDATE ON public.third_party_farms
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();