-- Create pregnancy_management table
CREATE TABLE public.pregnancy_management (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code INTEGER NOT NULL,
  name TEXT NOT NULL,
  sex TEXT NOT NULL,
  expected_birth_month DATE,
  breed_id UUID REFERENCES public.animal_breeds(id),
  category_id UUID REFERENCES public.animal_categories(id),
  auction_id UUID REFERENCES public.leiloes(id),
  auction_lot TEXT,
  sire_id UUID REFERENCES public.breeding_animals(id),
  dam_id UUID REFERENCES public.breeding_animals(id),
  farm_id UUID,
  farm_type TEXT,
  status TEXT NOT NULL DEFAULT 'in_progress',
  store_id UUID NOT NULL REFERENCES public.stores(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pregnancy_management ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view pregnancy management for their store"
ON public.pregnancy_management
FOR SELECT
USING ((get_user_role() = 'admin'::user_role) OR (store_id = get_user_store_id()));

CREATE POLICY "Users can create pregnancy management for their store"
ON public.pregnancy_management
FOR INSERT
WITH CHECK ((get_user_role() = 'admin'::user_role) OR (store_id = get_user_store_id()));

CREATE POLICY "Users can update pregnancy management for their store"
ON public.pregnancy_management
FOR UPDATE
USING ((get_user_role() = 'admin'::user_role) OR (store_id = get_user_store_id()));

CREATE POLICY "Users can delete pregnancy management for their store"
ON public.pregnancy_management
FOR DELETE
USING ((get_user_role() = 'admin'::user_role) OR (store_id = get_user_store_id()));

-- Create trigger for updated_at
CREATE TRIGGER update_pregnancy_management_updated_at
BEFORE UPDATE ON public.pregnancy_management
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();