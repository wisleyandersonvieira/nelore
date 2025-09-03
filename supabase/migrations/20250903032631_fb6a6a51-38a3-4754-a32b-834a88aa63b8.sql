-- Add subgroup_id column to system_parameters table
ALTER TABLE public.system_parameters 
ADD COLUMN subgroup_id uuid REFERENCES public.account_groups(id);