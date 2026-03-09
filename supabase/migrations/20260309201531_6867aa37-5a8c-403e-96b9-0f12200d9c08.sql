
CREATE TABLE public.animal_deaths (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id uuid REFERENCES public.animals(id) ON DELETE CASCADE NOT NULL,
  death_date date NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.animal_deaths ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view animal deaths in their stores"
  ON public.animal_deaths FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.animals a
    JOIN public.user_stores us ON a.store_id = us.store_id
    WHERE a.id = animal_deaths.animal_id AND us.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert animal deaths"
  ON public.animal_deaths FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.animals a
    JOIN public.user_stores us ON a.store_id = us.store_id
    WHERE a.id = animal_deaths.animal_id AND us.user_id = auth.uid()
  ));
