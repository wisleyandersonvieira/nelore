-- Create installments table for accounts receivable
CREATE TABLE public.accounts_receivable_installments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_receivable_id UUID NOT NULL REFERENCES public.accounts_receivable(id) ON DELETE CASCADE,
  installment_number INTEGER NOT NULL,
  due_date DATE NOT NULL,
  amount NUMERIC NOT NULL,
  payment_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.accounts_receivable_installments ENABLE ROW LEVEL SECURITY;

-- Create policies similar to accounts_payable_installments
CREATE POLICY "Users can view installments for their store"
ON public.accounts_receivable_installments
FOR SELECT
USING (
  user_has_permission('contas_receber'::text, 'read'::permission_type) 
  AND EXISTS (
    SELECT 1 FROM accounts_receivable ar
    WHERE ar.id = accounts_receivable_installments.account_receivable_id
    AND (get_user_role() = 'admin'::user_role OR ar.store_id = get_user_store_id())
  )
);

CREATE POLICY "Users can manage installments for their store"
ON public.accounts_receivable_installments
FOR ALL
USING (
  user_has_permission('contas_receber'::text, 'write'::permission_type) 
  AND EXISTS (
    SELECT 1 FROM accounts_receivable ar
    WHERE ar.id = accounts_receivable_installments.account_receivable_id
    AND (get_user_role() = 'admin'::user_role OR ar.store_id = get_user_store_id())
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_accounts_receivable_installments_updated_at
  BEFORE UPDATE ON public.accounts_receivable_installments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();