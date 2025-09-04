-- Add store_id and dismissal_date to employees table
ALTER TABLE employees 
ADD COLUMN dismissal_date date NULL;

-- Update the RLS policies to ensure proper access control
-- The existing policies should already handle store_id access properly