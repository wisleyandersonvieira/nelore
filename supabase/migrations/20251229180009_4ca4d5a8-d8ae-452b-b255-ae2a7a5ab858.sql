-- Fix security issue: stores table allows any authenticated user to create/update/delete
-- Only admins should be able to manage stores

-- Drop overly permissive policies on stores table
DROP POLICY IF EXISTS "Users can create stores" ON public.stores;
DROP POLICY IF EXISTS "Users can update stores" ON public.stores;
DROP POLICY IF EXISTS "Users can delete stores" ON public.stores;

-- Create admin-only policy for managing stores (keep existing view policy)
CREATE POLICY "Admins can manage stores" ON public.stores
FOR ALL USING (get_user_role() = 'admin'::user_role)
WITH CHECK (get_user_role() = 'admin'::user_role);

-- Fix security issue: account-store junction tables allow any authenticated user to modify associations
-- Only admins should be able to manage these associations

-- current_account_stores
DROP POLICY IF EXISTS "Users can create account store associations" ON public.current_account_stores;
DROP POLICY IF EXISTS "Users can update account store associations" ON public.current_account_stores;
DROP POLICY IF EXISTS "Users can delete account store associations" ON public.current_account_stores;

CREATE POLICY "Admins can manage account store associations" ON public.current_account_stores
FOR ALL USING (get_user_role() = 'admin'::user_role)
WITH CHECK (get_user_role() = 'admin'::user_role);

-- card_account_stores
DROP POLICY IF EXISTS "Users can create card account store associations" ON public.card_account_stores;
DROP POLICY IF EXISTS "Users can update card account store associations" ON public.card_account_stores;
DROP POLICY IF EXISTS "Users can delete card account store associations" ON public.card_account_stores;

CREATE POLICY "Admins can manage card account store associations" ON public.card_account_stores
FOR ALL USING (get_user_role() = 'admin'::user_role)
WITH CHECK (get_user_role() = 'admin'::user_role);

-- cash_account_stores
DROP POLICY IF EXISTS "Users can create cash account store associations" ON public.cash_account_stores;
DROP POLICY IF EXISTS "Users can update cash account store associations" ON public.cash_account_stores;
DROP POLICY IF EXISTS "Users can delete cash account store associations" ON public.cash_account_stores;

CREATE POLICY "Admins can manage cash account store associations" ON public.cash_account_stores
FOR ALL USING (get_user_role() = 'admin'::user_role)
WITH CHECK (get_user_role() = 'admin'::user_role);

-- delivery_account_stores
DROP POLICY IF EXISTS "Users can create delivery account store associations" ON public.delivery_account_stores;
DROP POLICY IF EXISTS "Users can update delivery account store associations" ON public.delivery_account_stores;
DROP POLICY IF EXISTS "Users can delete delivery account store associations" ON public.delivery_account_stores;

CREATE POLICY "Admins can manage delivery account store associations" ON public.delivery_account_stores
FOR ALL USING (get_user_role() = 'admin'::user_role)
WITH CHECK (get_user_role() = 'admin'::user_role);