-- Create table for employee obligations
CREATE TABLE public.employee_obligations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  recurrence_type TEXT NOT NULL DEFAULT 'unica' CHECK (recurrence_type IN ('unica', 'periodica')),
  recurrence_months INTEGER NULL,
  attachments JSONB DEFAULT '[]'::jsonb,
  store_id UUID NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.employee_obligations ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view obligations for their store"
ON public.employee_obligations
FOR SELECT
USING ((get_user_role() = 'admin'::user_role) OR (store_id = get_user_store_id()));

CREATE POLICY "Users can manage obligations for their store"
ON public.employee_obligations
FOR ALL
USING ((get_user_role() = 'admin'::user_role) OR (store_id = get_user_store_id()));

-- Create trigger for updated_at
CREATE TRIGGER update_employee_obligations_updated_at
BEFORE UPDATE ON public.employee_obligations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for obligation attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('obligation-attachments', 'obligation-attachments', false);

-- Storage policies
CREATE POLICY "Users can view obligation attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'obligation-attachments' AND auth.role() = 'authenticated');

CREATE POLICY "Users can upload obligation attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'obligation-attachments' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete obligation attachments"
ON storage.objects FOR DELETE
USING (bucket_id = 'obligation-attachments' AND auth.role() = 'authenticated');