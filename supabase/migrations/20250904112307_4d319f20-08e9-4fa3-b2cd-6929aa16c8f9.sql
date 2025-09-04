-- Add group_id column to system_parameters table
ALTER TABLE public.system_parameters 
ADD COLUMN group_id UUID REFERENCES public.account_groups(id) ON DELETE CASCADE;