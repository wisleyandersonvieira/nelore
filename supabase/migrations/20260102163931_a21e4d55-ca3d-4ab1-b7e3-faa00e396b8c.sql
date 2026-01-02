-- Fix function search_path
CREATE OR REPLACE FUNCTION get_next_leilao_code(store_uuid UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  next_code INTEGER;
BEGIN
  SELECT COALESCE(MAX(code), 0) + 1 INTO next_code
  FROM public.leiloes
  WHERE store_id = store_uuid;
  RETURN next_code;
END;
$$;