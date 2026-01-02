
-- Create table for animal batches (lotes)
CREATE TABLE public.animal_batches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  store_id UUID NOT NULL REFERENCES public.stores(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create unique constraint for code per store
CREATE UNIQUE INDEX idx_animal_batches_code_store ON public.animal_batches(code, store_id);

-- Create unique constraint for name per store
CREATE UNIQUE INDEX idx_animal_batches_name_store ON public.animal_batches(name, store_id);

-- Enable Row Level Security
ALTER TABLE public.animal_batches ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view animal batches for their store" 
ON public.animal_batches 
FOR SELECT 
USING ((get_user_role() = 'admin'::user_role) OR (store_id = get_user_store_id()));

CREATE POLICY "Users can create animal batches for their store" 
ON public.animal_batches 
FOR INSERT 
WITH CHECK ((get_user_role() = 'admin'::user_role) OR (store_id = get_user_store_id()));

CREATE POLICY "Users can update animal batches for their store" 
ON public.animal_batches 
FOR UPDATE 
USING ((get_user_role() = 'admin'::user_role) OR (store_id = get_user_store_id()));

CREATE POLICY "Users can delete animal batches for their store" 
ON public.animal_batches 
FOR DELETE 
USING ((get_user_role() = 'admin'::user_role) OR (store_id = get_user_store_id()));

-- Create function to get next batch code for a store
CREATE OR REPLACE FUNCTION public.get_next_animal_batch_code(store_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
  next_code INTEGER;
BEGIN
  SELECT COALESCE(MAX(code), 0) + 1 INTO next_code
  FROM public.animal_batches
  WHERE store_id = store_uuid;
  RETURN next_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_animal_batches_updated_at
BEFORE UPDATE ON public.animal_batches
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
