-- Add approval status to cash control table
ALTER TABLE public.cash_control 
ADD COLUMN approved_status boolean DEFAULT false,
ADD COLUMN approved_at timestamp with time zone,
ADD COLUMN approved_by uuid;