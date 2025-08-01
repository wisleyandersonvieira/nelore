-- Fix the DELETE policy for stores table
DROP POLICY IF EXISTS "Users can delete stores" ON stores;

-- Create a new policy that allows authenticated users to delete stores
CREATE POLICY "Users can delete stores" 
ON stores 
FOR DELETE 
USING (auth.role() = 'authenticated');