-- Add missing fields to suppliers table
ALTER TABLE public.suppliers 
ADD COLUMN IF NOT EXISTS city text,
ADD COLUMN IF NOT EXISTS state text;

-- Update RLS policies to allow users to manage suppliers
DROP POLICY IF EXISTS "Users can view suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Users can manage suppliers" ON public.suppliers;

CREATE POLICY "Users can view suppliers" 
ON public.suppliers 
FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Users can manage suppliers" 
ON public.suppliers 
FOR ALL 
USING (auth.role() = 'authenticated');

-- Add trigger for updated_at
CREATE TRIGGER update_suppliers_updated_at
BEFORE UPDATE ON public.suppliers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();