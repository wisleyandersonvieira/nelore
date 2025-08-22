-- Criar tabela para vincular produtos com fornecedores e códigos
CREATE TABLE public.product_supplier_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL,
  supplier_id UUID NOT NULL,
  supplier_code TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(product_id, supplier_id, supplier_code)
);

-- Enable Row Level Security
ALTER TABLE public.product_supplier_codes ENABLE ROW LEVEL SECURITY;

-- Create policies for product supplier codes
CREATE POLICY "Users can view product supplier codes" 
ON public.product_supplier_codes 
FOR SELECT 
USING (auth.role() = 'authenticated'::text);

CREATE POLICY "Users can manage product supplier codes" 
ON public.product_supplier_codes 
FOR ALL 
USING (auth.role() = 'authenticated'::text);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_product_supplier_codes_updated_at
BEFORE UPDATE ON public.product_supplier_codes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();