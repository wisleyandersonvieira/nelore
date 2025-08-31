-- Alterar o campo account_id para permitir valores NULL na criação
-- O account_id será preenchido apenas quando o pagamento for efetuado
ALTER TABLE accounts_payable 
ALTER COLUMN account_id DROP NOT NULL;