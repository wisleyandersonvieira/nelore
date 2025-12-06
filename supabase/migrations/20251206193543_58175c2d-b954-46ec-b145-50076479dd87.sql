-- Add column to track linked accounts payable
ALTER TABLE public.cash_control_expenses 
ADD COLUMN linked_account_payable_id uuid REFERENCES public.accounts_payable(id) ON DELETE SET NULL;