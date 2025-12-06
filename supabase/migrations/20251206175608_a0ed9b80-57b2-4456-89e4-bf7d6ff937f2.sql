-- Add reference month and year columns to cash_control_expenses
ALTER TABLE public.cash_control_expenses
ADD COLUMN reference_month INTEGER NOT NULL DEFAULT EXTRACT(MONTH FROM CURRENT_DATE),
ADD COLUMN reference_year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE);

-- Create index for better query performance
CREATE INDEX idx_cash_control_expenses_reference ON public.cash_control_expenses(store_id, expense_type, reference_month, reference_year);