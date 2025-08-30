-- Create a default account group if it doesn't exist
INSERT INTO account_groups (id, name, code, account_type)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'Contas a Pagar',
  '2.1',
  'liability'
)
ON CONFLICT (id) DO NOTHING;

-- Create a default chart of accounts entry for accounts payable
INSERT INTO chart_of_accounts (id, group_id, name, code, account_type)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111',
  'Fornecedores',
  '2.1.01',
  'liability'
)
ON CONFLICT (id) DO NOTHING;