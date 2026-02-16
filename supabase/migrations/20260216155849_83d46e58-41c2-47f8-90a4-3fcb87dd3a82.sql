
-- Create table for Pós Transferência de Embrião management
CREATE TABLE public.embryo_transfer_management (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code INTEGER NOT NULL,
  name TEXT NOT NULL,
  expected_aspiration_month TEXT NULL,
  breed_id UUID NULL REFERENCES public.animal_breeds(id),
  category_id UUID NULL REFERENCES public.animal_categories(id),
  auction_id UUID NULL REFERENCES public.leiloes(id),
  auction_lot TEXT NULL,
  dam_id UUID NULL REFERENCES public.breeding_animals(id),
  sire_id UUID NULL REFERENCES public.breeding_animals(id),
  recipient_id UUID NULL REFERENCES public.animals(id),
  farm_id TEXT NULL,
  farm_type TEXT NULL,
  status TEXT NOT NULL DEFAULT 'in_progress',
  store_id UUID NOT NULL REFERENCES public.stores(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.embryo_transfer_management ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view embryo transfer records" ON public.embryo_transfer_management
  FOR SELECT USING (true);

CREATE POLICY "Users can insert embryo transfer records" ON public.embryo_transfer_management
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update embryo transfer records" ON public.embryo_transfer_management
  FOR UPDATE USING (true);

CREATE POLICY "Users can delete embryo transfer records" ON public.embryo_transfer_management
  FOR DELETE USING (true);
