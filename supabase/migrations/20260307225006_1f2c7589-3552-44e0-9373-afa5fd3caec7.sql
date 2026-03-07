
-- Create animal_sales table
CREATE TABLE public.animal_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id uuid NOT NULL REFERENCES public.animals(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.suppliers(id),
  sale_date date NOT NULL,
  sale_value numeric NOT NULL,
  sale_percentage numeric NOT NULL CHECK (sale_percentage > 0 AND sale_percentage <= 100),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.animal_sales ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view animal sales in their store"
  ON public.animal_sales FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.animals a
      JOIN public.user_stores us ON a.store_id = us.store_id
      WHERE a.id = animal_sales.animal_id AND us.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert animal sales"
  ON public.animal_sales FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.animals a
      JOIN public.user_stores us ON a.store_id = us.store_id
      WHERE a.id = animal_sales.animal_id AND us.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update animal sales"
  ON public.animal_sales FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.animals a
      JOIN public.user_stores us ON a.store_id = us.store_id
      WHERE a.id = animal_sales.animal_id AND us.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete animal sales"
  ON public.animal_sales FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.animals a
      JOIN public.user_stores us ON a.store_id = us.store_id
      WHERE a.id = animal_sales.animal_id AND us.user_id = auth.uid()
    )
  );
