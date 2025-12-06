-- Create table for cash control expenses (general cash and bank payments)
CREATE TABLE public.cash_control_expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id),
  expense_type TEXT NOT NULL CHECK (expense_type IN ('caixa_geral', 'banco')),
  issue_date DATE NOT NULL,
  supplier TEXT NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  attachments JSONB DEFAULT '[]'::jsonb,
  attachment_status JSONB DEFAULT '{}'::jsonb,
  is_disabled BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL,
  created_by_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  edit_history JSONB DEFAULT '[]'::jsonb
);

-- Enable RLS
ALTER TABLE public.cash_control_expenses ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view expenses for their store"
ON public.cash_control_expenses
FOR SELECT
USING (
  user_has_permission('caixa'::text, 'read'::permission_type) 
  AND (
    (get_user_role() = 'admin'::user_role) 
    OR (store_id = get_user_store_id())
  )
);

CREATE POLICY "Users can manage expenses for their store"
ON public.cash_control_expenses
FOR ALL
USING (
  user_has_permission('caixa'::text, 'write'::permission_type) 
  AND (
    (get_user_role() = 'admin'::user_role) 
    OR (store_id = get_user_store_id())
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_cash_control_expenses_updated_at
BEFORE UPDATE ON public.cash_control_expenses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();