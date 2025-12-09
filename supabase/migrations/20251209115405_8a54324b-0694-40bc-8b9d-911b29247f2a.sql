
-- Update get_user_store_id to check user_stores table when profiles.store_id is null
CREATE OR REPLACE FUNCTION public.get_user_store_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT store_id FROM public.profiles WHERE id = auth.uid()),
    (SELECT store_id FROM public.user_stores WHERE user_id = auth.uid() LIMIT 1)
  );
$$;
