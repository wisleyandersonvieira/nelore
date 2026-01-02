-- Create leiloes (auctions) table
CREATE TABLE public.leiloes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code INTEGER NOT NULL,
  name TEXT NOT NULL,
  date DATE NOT NULL,
  city TEXT NOT NULL,
  store_id UUID NOT NULL REFERENCES public.stores(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(code, store_id)
);

-- Enable RLS
ALTER TABLE public.leiloes ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view leiloes for their store"
ON public.leiloes
FOR SELECT
USING ((get_user_role() = 'admin'::user_role) OR (store_id = get_user_store_id()));

CREATE POLICY "Users can create leiloes for their store"
ON public.leiloes
FOR INSERT
WITH CHECK ((get_user_role() = 'admin'::user_role) OR (store_id = get_user_store_id()));

CREATE POLICY "Users can update leiloes for their store"
ON public.leiloes
FOR UPDATE
USING ((get_user_role() = 'admin'::user_role) OR (store_id = get_user_store_id()));

CREATE POLICY "Users can delete leiloes for their store"
ON public.leiloes
FOR DELETE
USING ((get_user_role() = 'admin'::user_role) OR (store_id = get_user_store_id()));

-- Create function to get next leilao code
CREATE OR REPLACE FUNCTION get_next_leilao_code(store_uuid UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Create trigger to update updated_at
CREATE TRIGGER update_leiloes_updated_at
  BEFORE UPDATE ON public.leiloes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();