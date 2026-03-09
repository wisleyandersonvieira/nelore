
-- Animal owners table
CREATE TABLE public.animal_owners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  animal_id UUID NOT NULL REFERENCES public.animals(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  percentage NUMERIC(5,2) NOT NULL CHECK (percentage > 0 AND percentage <= 100),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(animal_id, owner_id)
);

-- Pregnancy owners table
CREATE TABLE public.pregnancy_owners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pregnancy_id UUID NOT NULL REFERENCES public.pregnancy_management(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  percentage NUMERIC(5,2) NOT NULL CHECK (percentage > 0 AND percentage <= 100),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(pregnancy_id, owner_id)
);

-- Aspiration owners table
CREATE TABLE public.aspiration_owners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  aspiration_id UUID NOT NULL REFERENCES public.aspiration_management(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  percentage NUMERIC(5,2) NOT NULL CHECK (percentage > 0 AND percentage <= 100),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(aspiration_id, owner_id)
);

-- Enable RLS
ALTER TABLE public.animal_owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pregnancy_owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aspiration_owners ENABLE ROW LEVEL SECURITY;

-- RLS policies for animal_owners
CREATE POLICY "Users can view animal owners in their matrix" ON public.animal_owners
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.animals a
    JOIN public.stores s ON a.store_id = s.id
    JOIN public.profiles p ON p.matrix_id = s.matrix_id
    WHERE a.id = animal_owners.animal_id AND p.id = auth.uid()
  ));

CREATE POLICY "Users can insert animal owners" ON public.animal_owners
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.animals a
    JOIN public.stores s ON a.store_id = s.id
    JOIN public.profiles p ON p.matrix_id = s.matrix_id
    WHERE a.id = animal_owners.animal_id AND p.id = auth.uid()
  ));

CREATE POLICY "Users can update animal owners" ON public.animal_owners
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.animals a
    JOIN public.stores s ON a.store_id = s.id
    JOIN public.profiles p ON p.matrix_id = s.matrix_id
    WHERE a.id = animal_owners.animal_id AND p.id = auth.uid()
  ));

CREATE POLICY "Users can delete animal owners" ON public.animal_owners
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.animals a
    JOIN public.stores s ON a.store_id = s.id
    JOIN public.profiles p ON p.matrix_id = s.matrix_id
    WHERE a.id = animal_owners.animal_id AND p.id = auth.uid()
  ));

-- RLS policies for pregnancy_owners
CREATE POLICY "Users can view pregnancy owners in their matrix" ON public.pregnancy_owners
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.pregnancy_management pm
    JOIN public.stores s ON pm.store_id = s.id
    JOIN public.profiles p ON p.matrix_id = s.matrix_id
    WHERE pm.id = pregnancy_owners.pregnancy_id AND p.id = auth.uid()
  ));

CREATE POLICY "Users can insert pregnancy owners" ON public.pregnancy_owners
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.pregnancy_management pm
    JOIN public.stores s ON pm.store_id = s.id
    JOIN public.profiles p ON p.matrix_id = s.matrix_id
    WHERE pm.id = pregnancy_owners.pregnancy_id AND p.id = auth.uid()
  ));

CREATE POLICY "Users can update pregnancy owners" ON public.pregnancy_owners
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.pregnancy_management pm
    JOIN public.stores s ON pm.store_id = s.id
    JOIN public.profiles p ON p.matrix_id = s.matrix_id
    WHERE pm.id = pregnancy_owners.pregnancy_id AND p.id = auth.uid()
  ));

CREATE POLICY "Users can delete pregnancy owners" ON public.pregnancy_owners
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.pregnancy_management pm
    JOIN public.stores s ON pm.store_id = s.id
    JOIN public.profiles p ON p.matrix_id = s.matrix_id
    WHERE pm.id = pregnancy_owners.pregnancy_id AND p.id = auth.uid()
  ));

-- RLS policies for aspiration_owners
CREATE POLICY "Users can view aspiration owners in their matrix" ON public.aspiration_owners
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.aspiration_management am
    JOIN public.stores s ON am.store_id = s.id
    JOIN public.profiles p ON p.matrix_id = s.matrix_id
    WHERE am.id = aspiration_owners.aspiration_id AND p.id = auth.uid()
  ));

CREATE POLICY "Users can insert aspiration owners" ON public.aspiration_owners
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.aspiration_management am
    JOIN public.stores s ON am.store_id = s.id
    JOIN public.profiles p ON p.matrix_id = s.matrix_id
    WHERE am.id = aspiration_owners.aspiration_id AND p.id = auth.uid()
  ));

CREATE POLICY "Users can update aspiration owners" ON public.aspiration_owners
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.aspiration_management am
    JOIN public.stores s ON am.store_id = s.id
    JOIN public.profiles p ON p.matrix_id = s.matrix_id
    WHERE am.id = aspiration_owners.aspiration_id AND p.id = auth.uid()
  ));

CREATE POLICY "Users can delete aspiration owners" ON public.aspiration_owners
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.aspiration_management am
    JOIN public.stores s ON am.store_id = s.id
    JOIN public.profiles p ON p.matrix_id = s.matrix_id
    WHERE am.id = aspiration_owners.aspiration_id AND p.id = auth.uid()
  ));
