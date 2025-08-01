-- Update RLS policies for stores table to allow authenticated users to manage stores
DROP POLICY IF EXISTS "Admins can manage stores" ON stores;

-- Create new policies that allow authenticated users to manage stores
CREATE POLICY "Users can create stores" 
ON stores 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update stores" 
ON stores 
FOR UPDATE 
USING (auth.role() = 'authenticated');

CREATE POLICY "Users can delete stores" 
ON stores 
FOR DELETE 
USING (get_user_role() = 'admin'::user_role);