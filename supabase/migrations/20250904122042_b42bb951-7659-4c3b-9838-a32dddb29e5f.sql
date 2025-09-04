-- Add employee_id column to accounts_payable table
ALTER TABLE public.accounts_payable 
ADD COLUMN employee_id UUID REFERENCES public.employees(id);

-- Add constraint to ensure either supplier_id or employee_id is set, but not both
ALTER TABLE public.accounts_payable 
ADD CONSTRAINT check_supplier_or_employee 
CHECK (
  (supplier_id IS NOT NULL AND employee_id IS NULL) OR
  (supplier_id IS NULL AND employee_id IS NOT NULL)
);