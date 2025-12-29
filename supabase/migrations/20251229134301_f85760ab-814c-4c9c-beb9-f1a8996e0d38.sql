-- Create accounts_receivable_payments table (equivalent to accounts_payable_payments)
CREATE TABLE public.accounts_receivable_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  installment_id UUID NOT NULL REFERENCES public.accounts_receivable_installments(id) ON DELETE CASCADE,
  account_receivable_id UUID NOT NULL REFERENCES public.accounts_receivable(id) ON DELETE CASCADE,
  payment_date DATE NOT NULL,
  amount_paid NUMERIC NOT NULL DEFAULT 0,
  interest_amount NUMERIC NOT NULL DEFAULT 0,
  discount_amount NUMERIC NOT NULL DEFAULT 0,
  interest_product_id UUID REFERENCES public.products(id),
  discount_product_id UUID REFERENCES public.products(id),
  payment_account_id UUID,
  payment_account_type TEXT,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.accounts_receivable_payments ENABLE ROW LEVEL SECURITY;

-- Create policies for accounts_receivable_payments
CREATE POLICY "Users can manage receivable payments for their store" 
ON public.accounts_receivable_payments 
FOR ALL 
USING (
  user_has_permission('contas_receber'::text, 'write'::permission_type) 
  AND (EXISTS (
    SELECT 1 FROM accounts_receivable ar
    WHERE ar.id = accounts_receivable_payments.account_receivable_id 
    AND ((get_user_role() = 'admin'::user_role) OR (ar.store_id = get_user_store_id()))
  ))
);

CREATE POLICY "Users can view receivable payments for their store" 
ON public.accounts_receivable_payments 
FOR SELECT 
USING (
  user_has_permission('contas_receber'::text, 'read'::permission_type) 
  AND (EXISTS (
    SELECT 1 FROM accounts_receivable ar
    WHERE ar.id = accounts_receivable_payments.account_receivable_id 
    AND ((get_user_role() = 'admin'::user_role) OR (ar.store_id = get_user_store_id()))
  ))
);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_accounts_receivable_payments_updated_at
BEFORE UPDATE ON public.accounts_receivable_payments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();