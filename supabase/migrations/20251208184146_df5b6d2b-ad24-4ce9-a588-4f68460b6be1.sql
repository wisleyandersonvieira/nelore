-- Criar tabela para registrar pagamentos de parcelas
CREATE TABLE public.accounts_payable_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  installment_id UUID NOT NULL REFERENCES public.accounts_payable_installments(id) ON DELETE CASCADE,
  account_payable_id UUID NOT NULL REFERENCES public.accounts_payable(id) ON DELETE CASCADE,
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

-- Índices para performance
CREATE INDEX idx_accounts_payable_payments_installment ON public.accounts_payable_payments(installment_id);
CREATE INDEX idx_accounts_payable_payments_account_payable ON public.accounts_payable_payments(account_payable_id);
CREATE INDEX idx_accounts_payable_payments_payment_date ON public.accounts_payable_payments(payment_date);

-- Habilitar RLS
ALTER TABLE public.accounts_payable_payments ENABLE ROW LEVEL SECURITY;

-- Políticas de segurança
CREATE POLICY "Users can view payments for their store"
ON public.accounts_payable_payments
FOR SELECT
USING (
  user_has_permission('contas_pagar', 'read') 
  AND EXISTS (
    SELECT 1 FROM accounts_payable ap 
    WHERE ap.id = accounts_payable_payments.account_payable_id 
    AND (get_user_role() = 'admin' OR ap.store_id = get_user_store_id())
  )
);

CREATE POLICY "Users can manage payments for their store"
ON public.accounts_payable_payments
FOR ALL
USING (
  user_has_permission('contas_pagar', 'write') 
  AND EXISTS (
    SELECT 1 FROM accounts_payable ap 
    WHERE ap.id = accounts_payable_payments.account_payable_id 
    AND (get_user_role() = 'admin' OR ap.store_id = get_user_store_id())
  )
);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_accounts_payable_payments_updated_at
BEFORE UPDATE ON public.accounts_payable_payments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();