-- Add due_date column for periodic obligations
ALTER TABLE public.employee_obligation_completions 
ADD COLUMN due_date date;