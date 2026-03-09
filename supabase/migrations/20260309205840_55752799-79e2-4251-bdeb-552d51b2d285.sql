
CREATE TABLE public.aspiration_sales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  aspiration_id UUID NOT NULL REFERENCES public.aspiration_management(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.suppliers(id),
  sale_date DATE NOT NULL,
  sale_value NUMERIC NOT NULL,
  sale_percentage NUMERIC NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.aspiration_sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view aspiration sales" ON public.aspiration_sales FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert aspiration sales" ON public.aspiration_sales FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update aspiration sales" ON public.aspiration_sales FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Users can delete aspiration sales" ON public.aspiration_sales FOR DELETE TO authenticated USING (true);
