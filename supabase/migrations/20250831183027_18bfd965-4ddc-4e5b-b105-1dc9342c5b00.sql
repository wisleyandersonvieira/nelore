-- Adicionar campo data_competencia na tabela accounts_payable
ALTER TABLE accounts_payable
ADD COLUMN data_competencia date;

-- Criar tabela para parcelas
CREATE TABLE accounts_payable_installments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_payable_id uuid NOT NULL REFERENCES accounts_payable(id) ON DELETE CASCADE,
  installment_number integer NOT NULL,
  due_date date NOT NULL,
  amount numeric NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Habilitar RLS na tabela de parcelas
ALTER TABLE accounts_payable_installments ENABLE ROW LEVEL SECURITY;

-- Criar políticas para a tabela de parcelas
CREATE POLICY "Users can manage installments for their store" 
ON accounts_payable_installments 
FOR ALL 
USING (
  user_has_permission('contas_pagar'::text, 'write'::permission_type) AND 
  EXISTS (
    SELECT 1 FROM accounts_payable ap 
    WHERE ap.id = accounts_payable_installments.account_payable_id 
    AND ((get_user_role() = 'admin'::user_role) OR (ap.store_id = get_user_store_id()))
  )
);

CREATE POLICY "Users can view installments for their store" 
ON accounts_payable_installments 
FOR SELECT 
USING (
  user_has_permission('contas_pagar'::text, 'read'::permission_type) AND 
  EXISTS (
    SELECT 1 FROM accounts_payable ap 
    WHERE ap.id = accounts_payable_installments.account_payable_id 
    AND ((get_user_role() = 'admin'::user_role) OR (ap.store_id = get_user_store_id()))
  )
);

-- Criar índice para melhor performance
CREATE INDEX idx_accounts_payable_installments_account_id ON accounts_payable_installments(account_payable_id);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_accounts_payable_installments_updated_at
BEFORE UPDATE ON accounts_payable_installments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();