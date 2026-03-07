
CREATE TABLE public.pregnancy_sales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pregnancy_id UUID NOT NULL REFERENCES public.pregnancy_management(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.suppliers(id),
  sale_date DATE NOT NULL,
  sale_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  sale_percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  CONSTRAINT sale_percentage_range CHECK (sale_percentage > 0 AND sale_percentage <= 100)
);

ALTER TABLE public.pregnancy_sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view pregnancy sales in their store"
ON public.pregnancy_sales
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.pregnancy_management pm
    JOIN public.user_stores us ON pm.store_id = us.store_id
    WHERE pm.id = pregnancy_sales.pregnancy_id
    AND us.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert pregnancy sales"
ON public.pregnancy_sales
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.pregnancy_management pm
    JOIN public.user_stores us ON pm.store_id = us.store_id
    WHERE pm.id = pregnancy_sales.pregnancy_id
    AND us.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete pregnancy sales"
ON public.pregnancy_sales
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.pregnancy_management pm
    JOIN public.user_stores us ON pm.store_id = us.store_id
    WHERE pm.id = pregnancy_sales.pregnancy_id
    AND us.user_id = auth.uid()
  )
);
