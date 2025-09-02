-- Add fields for attachments and edit audit to cash_control table
ALTER TABLE cash_control 
ADD COLUMN IF NOT EXISTS edited_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS edited_by UUID;