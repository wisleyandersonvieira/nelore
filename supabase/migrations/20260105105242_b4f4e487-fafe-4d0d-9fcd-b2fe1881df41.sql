-- Create aspiration management table
CREATE TABLE public.aspiration_management (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    code INTEGER NOT NULL,
    name TEXT NOT NULL,
    expected_aspiration_month DATE NULL,
    breed_id UUID NULL REFERENCES public.animal_breeds(id),
    category_id UUID NULL REFERENCES public.animal_categories(id),
    auction_id UUID NULL REFERENCES public.leiloes(id),
    auction_lot TEXT NULL,
    dam_id UUID NULL REFERENCES public.breeding_animals(id),
    farm_id UUID NULL,
    farm_type TEXT NULL,
    status TEXT NOT NULL DEFAULT 'in_progress',
    store_id UUID NOT NULL REFERENCES public.stores(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.aspiration_management ENABLE ROW LEVEL SECURITY;

-- Create policies for aspiration management
CREATE POLICY "Users can view aspiration records from their store" 
ON public.aspiration_management 
FOR SELECT 
USING (true);

CREATE POLICY "Users can create aspiration records" 
ON public.aspiration_management 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Users can update aspiration records" 
ON public.aspiration_management 
FOR UPDATE 
USING (true);

CREATE POLICY "Users can delete aspiration records" 
ON public.aspiration_management 
FOR DELETE 
USING (true);

-- Create index for better performance
CREATE INDEX idx_aspiration_management_store_id ON public.aspiration_management(store_id);
CREATE INDEX idx_aspiration_management_status ON public.aspiration_management(status);