-- Create weighing sessions table
CREATE TABLE public.weighing_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id),
  date DATE NOT NULL,
  weighing_type TEXT NOT NULL CHECK (weighing_type IN ('lote', 'avulso')),
  batch_id UUID REFERENCES public.animal_batches(id),
  observations TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create weighing records table (individual animal weights)
CREATE TABLE public.weighing_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.weighing_sessions(id) ON DELETE CASCADE,
  animal_id UUID NOT NULL REFERENCES public.animals(id),
  weight NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.weighing_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weighing_records ENABLE ROW LEVEL SECURITY;

-- RLS policies for weighing_sessions
CREATE POLICY "Users can view weighing sessions for their store"
ON public.weighing_sessions
FOR SELECT
USING ((get_user_role() = 'admin'::user_role) OR (store_id = get_user_store_id()));

CREATE POLICY "Users can create weighing sessions for their store"
ON public.weighing_sessions
FOR INSERT
WITH CHECK ((get_user_role() = 'admin'::user_role) OR (store_id = get_user_store_id()));

CREATE POLICY "Users can update weighing sessions for their store"
ON public.weighing_sessions
FOR UPDATE
USING ((get_user_role() = 'admin'::user_role) OR (store_id = get_user_store_id()));

CREATE POLICY "Users can delete weighing sessions for their store"
ON public.weighing_sessions
FOR DELETE
USING ((get_user_role() = 'admin'::user_role) OR (store_id = get_user_store_id()));

-- RLS policies for weighing_records
CREATE POLICY "Users can view weighing records for their store"
ON public.weighing_records
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.weighing_sessions ws
  WHERE ws.id = weighing_records.session_id
  AND ((get_user_role() = 'admin'::user_role) OR (ws.store_id = get_user_store_id()))
));

CREATE POLICY "Users can create weighing records for their store"
ON public.weighing_records
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.weighing_sessions ws
  WHERE ws.id = weighing_records.session_id
  AND ((get_user_role() = 'admin'::user_role) OR (ws.store_id = get_user_store_id()))
));

CREATE POLICY "Users can update weighing records for their store"
ON public.weighing_records
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.weighing_sessions ws
  WHERE ws.id = weighing_records.session_id
  AND ((get_user_role() = 'admin'::user_role) OR (ws.store_id = get_user_store_id()))
));

CREATE POLICY "Users can delete weighing records for their store"
ON public.weighing_records
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.weighing_sessions ws
  WHERE ws.id = weighing_records.session_id
  AND ((get_user_role() = 'admin'::user_role) OR (ws.store_id = get_user_store_id()))
));

-- Create trigger for updated_at
CREATE TRIGGER update_weighing_sessions_updated_at
BEFORE UPDATE ON public.weighing_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_weighing_records_updated_at
BEFORE UPDATE ON public.weighing_records
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();