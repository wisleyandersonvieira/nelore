-- Add attachments column to accounts_receivable table
ALTER TABLE public.accounts_receivable 
ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT NULL;