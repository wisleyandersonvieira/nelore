-- Create table for system parameters
CREATE TABLE public.system_parameters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parameter_key TEXT NOT NULL UNIQUE,
  product_id UUID REFERENCES public.products(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.system_parameters ENABLE ROW LEVEL SECURITY;

-- Create policies - system parameters should be accessible to authenticated users
CREATE POLICY "Authenticated users can view system parameters" 
ON public.system_parameters 
FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert system parameters" 
ON public.system_parameters 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update system parameters" 
ON public.system_parameters 
FOR UPDATE 
USING (auth.role() = 'authenticated');

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_system_parameters_updated_at
BEFORE UPDATE ON public.system_parameters
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();