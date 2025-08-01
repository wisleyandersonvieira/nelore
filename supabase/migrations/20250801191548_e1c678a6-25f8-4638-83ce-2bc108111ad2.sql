-- Fix the SELECT policy for stores table
DROP POLICY IF EXISTS "Users can view their store" ON stores;

-- Create a new policy that allows authenticated users to view all stores
CREATE POLICY "Users can view all stores" 
ON stores 
FOR SELECT 
USING (auth.role() = 'authenticated');