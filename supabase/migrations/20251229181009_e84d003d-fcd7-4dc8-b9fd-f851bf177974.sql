-- Fix security issue: get_user_store_id() function has insecure search_path
-- Change from 'public' to '' (empty string) to prevent search_path manipulation attacks

CREATE OR REPLACE FUNCTION public.get_user_store_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = ''
AS $function$
  SELECT COALESCE(
    (SELECT store_id FROM public.profiles WHERE id = auth.uid()),
    (SELECT store_id FROM public.user_stores WHERE user_id = auth.uid() LIMIT 1)
  );
$function$;