-- Create units of measure table
CREATE TABLE public.units_of_measure (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.units_of_measure ENABLE ROW LEVEL SECURITY;

-- Create policies for units of measure
CREATE POLICY "Users can view units of measure" 
ON public.units_of_measure 
FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Users can manage units of measure" 
ON public.units_of_measure 
FOR ALL 
USING (auth.role() = 'authenticated');

-- Add missing columns to products table
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES public.units_of_measure(id),
ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.account_groups(id),
ADD COLUMN IF NOT EXISTS subgroup_id UUID REFERENCES public.account_groups(id),
ADD COLUMN IF NOT EXISTS barcode TEXT,
ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN NOT NULL DEFAULT false;

-- Update products table policies to allow management
DROP POLICY IF EXISTS "Users can view products" ON public.products;

CREATE POLICY "Users can view products" 
ON public.products 
FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Users can manage products" 
ON public.products 
FOR ALL 
USING (auth.role() = 'authenticated');

-- Create function to get next product code
CREATE OR REPLACE FUNCTION get_next_product_code()
RETURNS INTEGER
LANGUAGE sql
AS $$
  SELECT COALESCE(MAX(CAST(code AS INTEGER)), 0) + 1 
  FROM public.products 
  WHERE code ~ '^[0-9]+$';
$$;

-- Create trigger for units updated_at
CREATE TRIGGER update_units_updated_at
BEFORE UPDATE ON public.units_of_measure
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert some default units of measure
INSERT INTO public.units_of_measure (name, symbol) VALUES
('Unidade', 'UN'),
('Quilograma', 'KG'),
('Litro', 'L'),
('Metro', 'M'),
('Caixa', 'CX'),
('Pacote', 'PCT'),
('Dúzia', 'DZ'),
('Centena', 'CT');