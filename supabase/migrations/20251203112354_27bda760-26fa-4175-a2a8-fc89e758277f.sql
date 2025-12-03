-- Create table for multiple attachments per obligation completion
CREATE TABLE public.employee_obligation_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  completion_id UUID NOT NULL REFERENCES public.employee_obligation_completions(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  uploaded_by UUID NOT NULL
);

-- Enable RLS
ALTER TABLE public.employee_obligation_attachments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view obligation attachments"
ON public.employee_obligation_attachments
FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert obligation attachments"
ON public.employee_obligation_attachments
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can delete obligation attachments"
ON public.employee_obligation_attachments
FOR DELETE
USING (auth.role() = 'authenticated');

-- Create index for faster lookups
CREATE INDEX idx_obligation_attachments_completion_id 
ON public.employee_obligation_attachments(completion_id);