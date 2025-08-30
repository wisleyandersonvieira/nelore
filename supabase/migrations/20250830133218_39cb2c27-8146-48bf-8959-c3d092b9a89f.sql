-- Remover contas de exemplo/seed que estão impedindo a gestão dos grupos
DELETE FROM chart_of_accounts 
WHERE name IN ('Contas a Pagar', 'Contas a Receber') 
  AND code IN ('1.1.001', '1.1.002')
  AND created_at = '2025-08-11 03:07:43.611213+00';