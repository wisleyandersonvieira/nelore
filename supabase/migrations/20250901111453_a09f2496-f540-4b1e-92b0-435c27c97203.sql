-- Criar parcelas de teste para a conta 51e2ea6f-b149-4799-a0d7-839a3d29e55c
INSERT INTO accounts_payable_installments (
  account_payable_id,
  installment_number,
  due_date,
  amount
) VALUES 
  ('51e2ea6f-b149-4799-a0d7-839a3d29e55c', 1, '2025-08-20', 3000.00),
  ('51e2ea6f-b149-4799-a0d7-839a3d29e55c', 2, '2025-09-20', 3000.00),
  ('51e2ea6f-b149-4799-a0d7-839a3d29e55c', 3, '2025-10-20', 3000.00);