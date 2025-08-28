-- Drop the incorrect foreign key constraint
ALTER TABLE public.financial_transactions 
DROP CONSTRAINT IF EXISTS financial_transactions_account_id_fkey;

-- Add the correct foreign key constraint to current_accounts
ALTER TABLE public.financial_transactions 
ADD CONSTRAINT financial_transactions_account_id_fkey 
FOREIGN KEY (account_id) REFERENCES public.current_accounts(id);