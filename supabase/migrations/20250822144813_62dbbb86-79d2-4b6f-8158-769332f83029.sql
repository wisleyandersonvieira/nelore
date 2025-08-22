-- Fix function search path security issue
-- The get_next_product_code function needs proper search_path setting

CREATE OR REPLACE FUNCTION public.get_next_product_code()
 RETURNS integer
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT COALESCE(MAX(CAST(code AS INTEGER)), 0) + 1 
  FROM public.products 
  WHERE code ~ '^[0-9]+$';
$function$;