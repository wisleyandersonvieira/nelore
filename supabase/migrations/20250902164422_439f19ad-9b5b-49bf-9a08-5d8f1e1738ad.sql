-- Make bank and account_number optional for cash_accounts
ALTER TABLE public.cash_accounts 
ALTER COLUMN bank DROP NOT NULL,
ALTER COLUMN account_number DROP NOT NULL;