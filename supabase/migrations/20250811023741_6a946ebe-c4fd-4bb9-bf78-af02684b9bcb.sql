-- Create creditors table (similar to suppliers)
CREATE TABLE public.creditors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  cnpj_cpf TEXT,
  address TEXT,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  city TEXT,
  state TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.creditors ENABLE ROW LEVEL SECURITY;

-- Create policies for creditors (same as suppliers)
CREATE POLICY "Users can manage creditors" 
ON public.creditors 
FOR ALL 
USING (auth.role() = 'authenticated');

CREATE POLICY "Users can view creditors" 
ON public.creditors 
FOR SELECT 
USING (auth.role() = 'authenticated');

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_creditors_updated_at
BEFORE UPDATE ON public.creditors
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();