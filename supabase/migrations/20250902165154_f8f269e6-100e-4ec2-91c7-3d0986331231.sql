-- Remove the foreign key constraint that restricts account_id to current_accounts only
ALTER TABLE public.financial_transactions 
DROP CONSTRAINT IF EXISTS financial_transactions_account_id_fkey;

-- Add a comment to clarify that account_id can reference any type of account
COMMENT ON COLUMN public.financial_transactions.account_id IS 'References account IDs from current_accounts, cash_accounts, or card_accounts tables';