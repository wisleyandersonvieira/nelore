-- Fix security vulnerability in current_accounts table
-- Current policies allow all authenticated users to access sensitive financial data
-- We need to implement store-specific access controls

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Users can create current accounts" ON public.current_accounts;
DROP POLICY IF EXISTS "Users can delete current accounts" ON public.current_accounts;
DROP POLICY IF EXISTS "Users can update current accounts" ON public.current_accounts;
DROP POLICY IF EXISTS "Users can view current accounts" ON public.current_accounts;

-- Create secure policies that respect store access and permissions
-- SELECT: Users can only view accounts associated with their store (or admins see all)
CREATE POLICY "Users can view current accounts for their store" 
ON public.current_accounts 
FOR SELECT 
USING (
  user_has_permission('financeiro'::text, 'read'::permission_type) 
  AND (
    get_user_role() = 'admin'::user_role 
    OR EXISTS (
      SELECT 1 FROM public.current_account_stores cas 
      WHERE cas.account_id = current_accounts.id 
      AND cas.store_id = get_user_store_id()
    )
  )
);

-- INSERT: Users can create accounts but only with proper permissions
CREATE POLICY "Users can create current accounts with permissions" 
ON public.current_accounts 
FOR INSERT 
WITH CHECK (
  user_has_permission('financeiro'::text, 'write'::permission_type)
);

-- UPDATE: Users can only update accounts associated with their store
CREATE POLICY "Users can update current accounts for their store" 
ON public.current_accounts 
FOR UPDATE 
USING (
  user_has_permission('financeiro'::text, 'write'::permission_type) 
  AND (
    get_user_role() = 'admin'::user_role 
    OR EXISTS (
      SELECT 1 FROM public.current_account_stores cas 
      WHERE cas.account_id = current_accounts.id 
      AND cas.store_id = get_user_store_id()
    )
  )
);

-- DELETE: Users can only delete accounts associated with their store
CREATE POLICY "Users can delete current accounts for their store" 
ON public.current_accounts 
FOR DELETE 
USING (
  user_has_permission('financeiro'::text, 'write'::permission_type) 
  AND (
    get_user_role() = 'admin'::user_role 
    OR EXISTS (
      SELECT 1 FROM public.current_account_stores cas 
      WHERE cas.account_id = current_accounts.id 
      AND cas.store_id = get_user_store_id()
    )
  )
);