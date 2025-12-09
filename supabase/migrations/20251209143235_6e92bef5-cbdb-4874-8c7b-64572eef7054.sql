-- Drop existing RLS policies for job_functions
DROP POLICY IF EXISTS "Users can manage job functions for their store" ON job_functions;
DROP POLICY IF EXISTS "Users can view job functions for their store" ON job_functions;

-- Create new policy to allow all authenticated users to view all job functions
CREATE POLICY "All users can view all job functions" 
ON job_functions 
FOR SELECT 
USING (auth.role() = 'authenticated');

-- Create policy to allow admins to manage all job functions
CREATE POLICY "Admins can manage all job functions" 
ON job_functions 
FOR ALL 
USING (get_user_role() = 'admin');

-- Create policy to allow users with write permission to manage job functions for their store
CREATE POLICY "Users can manage job functions for their store" 
ON job_functions 
FOR ALL 
USING (
  (get_user_role() != 'admin') AND 
  (store_id = get_user_store_id())
);