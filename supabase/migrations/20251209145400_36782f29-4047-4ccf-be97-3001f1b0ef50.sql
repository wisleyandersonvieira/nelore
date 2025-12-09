-- Drop existing RLS policies for employee_obligations
DROP POLICY IF EXISTS "Users can manage obligations for their store" ON public.employee_obligations;
DROP POLICY IF EXISTS "Users can view obligations for their store" ON public.employee_obligations;

-- Create new policy to allow all authenticated users to view all obligations
CREATE POLICY "All users can view all obligations" 
ON public.employee_obligations 
FOR SELECT 
USING (auth.role() = 'authenticated');

-- Create policy for admins to manage all obligations
CREATE POLICY "Admins can manage all obligations" 
ON public.employee_obligations 
FOR ALL 
USING (get_user_role() = 'admin');

-- Create policy for non-admin users to manage obligations for their store
CREATE POLICY "Users can manage obligations for their store" 
ON public.employee_obligations 
FOR ALL 
USING (
  get_user_role() <> 'admin' 
  AND store_id = get_user_store_id()
);