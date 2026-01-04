-- Make store_id nullable in third_party_farms
ALTER TABLE public.third_party_farms ALTER COLUMN store_id DROP NOT NULL;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view third party farms for their store" ON public.third_party_farms;
DROP POLICY IF EXISTS "Users can create third party farms for their store" ON public.third_party_farms;
DROP POLICY IF EXISTS "Users can update third party farms for their store" ON public.third_party_farms;
DROP POLICY IF EXISTS "Users can delete third party farms for their store" ON public.third_party_farms;

-- Create new policies for all authenticated users
CREATE POLICY "Authenticated users can view third party farms"
ON public.third_party_farms
FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can create third party farms"
ON public.third_party_farms
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update third party farms"
ON public.third_party_farms
FOR UPDATE
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete third party farms"
ON public.third_party_farms
FOR DELETE
USING (auth.role() = 'authenticated');

-- Update function to not require store_id
CREATE OR REPLACE FUNCTION public.get_next_third_party_farm_code()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  next_code INTEGER;
BEGIN
  SELECT COALESCE(MAX(code), 0) + 1 INTO next_code
  FROM public.third_party_farms;
  RETURN next_code;
END;
$$;