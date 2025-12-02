-- Tabela para rastrear conclusões de obrigações dos funcionários
CREATE TABLE public.employee_obligation_completions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  obligation_id UUID NOT NULL REFERENCES public.employee_obligations(id) ON DELETE CASCADE,
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_by UUID NOT NULL,
  attachment_url TEXT,
  notes TEXT,
  -- Para obrigações periódicas, rastrear o mês/ano de referência
  reference_month INTEGER,
  reference_year INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_obligation_completions_employee ON public.employee_obligation_completions(employee_id);
CREATE INDEX idx_obligation_completions_obligation ON public.employee_obligation_completions(obligation_id);
CREATE INDEX idx_obligation_completions_reference ON public.employee_obligation_completions(reference_year, reference_month);

-- Enable RLS
ALTER TABLE public.employee_obligation_completions ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can view obligation completions for their store"
ON public.employee_obligation_completions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM employees e
    WHERE e.id = employee_obligation_completions.employee_id
    AND (get_user_role() = 'admin' OR e.store_id = get_user_store_id())
  )
);

CREATE POLICY "Users can manage obligation completions for their store"
ON public.employee_obligation_completions
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM employees e
    WHERE e.id = employee_obligation_completions.employee_id
    AND (get_user_role() = 'admin' OR e.store_id = get_user_store_id())
  )
);

-- Trigger para updated_at
CREATE TRIGGER update_obligation_completions_updated_at
BEFORE UPDATE ON public.employee_obligation_completions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();