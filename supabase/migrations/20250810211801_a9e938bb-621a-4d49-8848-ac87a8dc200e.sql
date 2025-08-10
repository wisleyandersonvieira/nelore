-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can view current accounts for their stores" ON public.current_accounts;
DROP POLICY IF EXISTS "Admins can manage all current accounts" ON public.current_accounts;
DROP POLICY IF EXISTS "Users can view account store associations for their stores" ON public.current_account_stores;
DROP POLICY IF EXISTS "Admins can manage account store associations" ON public.current_account_stores;

-- Create more permissive policies for current_accounts
CREATE POLICY "Users can view current accounts" 
ON public.current_accounts 
FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Users can create current accounts" 
ON public.current_accounts 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update current accounts" 
ON public.current_accounts 
FOR UPDATE 
USING (auth.role() = 'authenticated');

CREATE POLICY "Users can delete current accounts" 
ON public.current_accounts 
FOR DELETE 
USING (auth.role() = 'authenticated');

-- Create policies for current_account_stores
CREATE POLICY "Users can view account store associations" 
ON public.current_account_stores 
FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Users can create account store associations" 
ON public.current_account_stores 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update account store associations" 
ON public.current_account_stores 
FOR UPDATE 
USING (auth.role() = 'authenticated');

CREATE POLICY "Users can delete account store associations" 
ON public.current_account_stores 
FOR DELETE 
USING (auth.role() = 'authenticated');