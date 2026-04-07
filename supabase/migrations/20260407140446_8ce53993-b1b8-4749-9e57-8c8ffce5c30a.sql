ALTER TABLE public.accounts_payable_installments 
ADD COLUMN status TEXT NOT NULL DEFAULT 'pending';

-- Update existing installments: if payment_date is set, mark as paid
UPDATE public.accounts_payable_installments 
SET status = 'paid' 
WHERE payment_date IS NOT NULL;