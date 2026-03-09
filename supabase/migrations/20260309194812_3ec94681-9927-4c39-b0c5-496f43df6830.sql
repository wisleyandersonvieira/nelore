
-- Embryo transfer owners table
CREATE TABLE public.embryo_transfer_owners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  embryo_transfer_id UUID NOT NULL REFERENCES public.embryo_transfer_management(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  percentage NUMERIC(5,2) NOT NULL CHECK (percentage > 0 AND percentage <= 100),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(embryo_transfer_id, owner_id)
);

ALTER TABLE public.embryo_transfer_owners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view embryo transfer owners in their matrix" ON public.embryo_transfer_owners
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.embryo_transfer_management etm
    JOIN public.stores s ON etm.store_id = s.id
    JOIN public.profiles p ON p.matrix_id = s.matrix_id
    WHERE etm.id = embryo_transfer_owners.embryo_transfer_id AND p.id = auth.uid()
  ));

CREATE POLICY "Users can insert embryo transfer owners" ON public.embryo_transfer_owners
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.embryo_transfer_management etm
    JOIN public.stores s ON etm.store_id = s.id
    JOIN public.profiles p ON p.matrix_id = s.matrix_id
    WHERE etm.id = embryo_transfer_owners.embryo_transfer_id AND p.id = auth.uid()
  ));

CREATE POLICY "Users can update embryo transfer owners" ON public.embryo_transfer_owners
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.embryo_transfer_management etm
    JOIN public.stores s ON etm.store_id = s.id
    JOIN public.profiles p ON p.matrix_id = s.matrix_id
    WHERE etm.id = embryo_transfer_owners.embryo_transfer_id AND p.id = auth.uid()
  ));

CREATE POLICY "Users can delete embryo transfer owners" ON public.embryo_transfer_owners
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.embryo_transfer_management etm
    JOIN public.stores s ON etm.store_id = s.id
    JOIN public.profiles p ON p.matrix_id = s.matrix_id
    WHERE etm.id = embryo_transfer_owners.embryo_transfer_id AND p.id = auth.uid()
  ));
