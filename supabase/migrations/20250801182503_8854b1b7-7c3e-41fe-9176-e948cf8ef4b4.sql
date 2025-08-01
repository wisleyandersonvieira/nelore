-- Drop dependent policies first
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their store" ON public.stores;
DROP POLICY IF EXISTS "Admins can manage stores" ON public.stores;
DROP POLICY IF EXISTS "Admins can manage permissions" ON public.user_permissions;
DROP POLICY IF EXISTS "Users can view cash control for their store" ON public.cash_control;
DROP POLICY IF EXISTS "Users can manage cash control for their store" ON public.cash_control;
DROP POLICY IF EXISTS "Users can view accounts payable for their store" ON public.accounts_payable;
DROP POLICY IF EXISTS "Users can manage accounts payable for their store" ON public.accounts_payable;
DROP POLICY IF EXISTS "Users can view accounts receivable for their store" ON public.accounts_receivable;
DROP POLICY IF EXISTS "Users can manage accounts receivable for their store" ON public.accounts_receivable;
DROP POLICY IF EXISTS "Users can view transactions for their store" ON public.financial_transactions;
DROP POLICY IF EXISTS "Users can create transactions for their store" ON public.financial_transactions;
DROP POLICY IF EXISTS "Admins can manage account groups" ON public.account_groups;
DROP POLICY IF EXISTS "Admins can manage chart of accounts" ON public.chart_of_accounts;

-- Now drop and recreate functions with proper search_path
DROP FUNCTION IF EXISTS public.get_user_role() CASCADE;
DROP FUNCTION IF EXISTS public.get_user_store_id() CASCADE;
DROP FUNCTION IF EXISTS public.user_has_permission(TEXT, permission_type) CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;

-- Recreate functions with proper search_path
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'name', NEW.email),
    NEW.email
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS user_role 
LANGUAGE SQL 
SECURITY DEFINER 
STABLE
SET search_path = ''
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_user_store_id()
RETURNS UUID 
LANGUAGE SQL 
SECURITY DEFINER 
STABLE
SET search_path = ''
AS $$
  SELECT store_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.user_has_permission(module_name TEXT, required_permission permission_type)
RETURNS BOOLEAN 
LANGUAGE plpgsql 
SECURITY DEFINER 
STABLE
SET search_path = ''
AS $$
BEGIN
  -- Admin role has all permissions
  IF public.get_user_role() = 'admin' THEN
    RETURN TRUE;
  END IF;
  
  -- Check specific permissions
  RETURN EXISTS (
    SELECT 1 FROM public.user_permissions up
    WHERE up.user_id = auth.uid()
    AND up.module = module_name
    AND (
      up.permission = required_permission 
      OR up.permission = 'admin'
      OR (required_permission = 'read' AND up.permission = 'write')
    )
    AND (up.store_id IS NULL OR up.store_id = public.get_user_store_id())
  );
END;
$$;

-- Recreate all triggers that were dropped
CREATE TRIGGER update_stores_updated_at BEFORE UPDATE ON public.stores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_chart_of_accounts_updated_at BEFORE UPDATE ON public.chart_of_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_cash_control_updated_at BEFORE UPDATE ON public.cash_control FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_accounts_payable_updated_at BEFORE UPDATE ON public.accounts_payable FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_accounts_receivable_updated_at BEFORE UPDATE ON public.accounts_receivable FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Recreate the user registration trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Recreate all the RLS policies
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.get_user_role() = 'admin');
CREATE POLICY "Admins can manage all profiles" ON public.profiles FOR ALL USING (public.get_user_role() = 'admin');

CREATE POLICY "Users can view their store" ON public.stores FOR SELECT USING (
  public.get_user_role() = 'admin' OR id = public.get_user_store_id()
);
CREATE POLICY "Admins can manage stores" ON public.stores FOR ALL USING (public.get_user_role() = 'admin');

CREATE POLICY "Admins can manage permissions" ON public.user_permissions FOR ALL USING (public.get_user_role() = 'admin');

CREATE POLICY "Users can view cash control for their store" ON public.cash_control FOR SELECT USING (
  public.user_has_permission('caixa', 'read') AND 
  (public.get_user_role() = 'admin' OR store_id = public.get_user_store_id())
);
CREATE POLICY "Users can manage cash control for their store" ON public.cash_control FOR ALL USING (
  public.user_has_permission('caixa', 'write') AND 
  (public.get_user_role() = 'admin' OR store_id = public.get_user_store_id())
);

CREATE POLICY "Users can view accounts payable for their store" ON public.accounts_payable FOR SELECT USING (
  public.user_has_permission('contas_pagar', 'read') AND 
  (public.get_user_role() = 'admin' OR store_id = public.get_user_store_id())
);
CREATE POLICY "Users can manage accounts payable for their store" ON public.accounts_payable FOR ALL USING (
  public.user_has_permission('contas_pagar', 'write') AND 
  (public.get_user_role() = 'admin' OR store_id = public.get_user_store_id())
);

CREATE POLICY "Users can view accounts receivable for their store" ON public.accounts_receivable FOR SELECT USING (
  public.user_has_permission('contas_receber', 'read') AND 
  (public.get_user_role() = 'admin' OR store_id = public.get_user_store_id())
);
CREATE POLICY "Users can manage accounts receivable for their store" ON public.accounts_receivable FOR ALL USING (
  public.user_has_permission('contas_receber', 'write') AND 
  (public.get_user_role() = 'admin' OR store_id = public.get_user_store_id())
);

CREATE POLICY "Users can view transactions for their store" ON public.financial_transactions FOR SELECT USING (
  public.user_has_permission('financeiro', 'read') AND 
  (public.get_user_role() = 'admin' OR store_id = public.get_user_store_id())
);
CREATE POLICY "Users can create transactions for their store" ON public.financial_transactions FOR INSERT WITH CHECK (
  public.user_has_permission('financeiro', 'write') AND 
  (public.get_user_role() = 'admin' OR store_id = public.get_user_store_id()) AND
  created_by = auth.uid()
);

CREATE POLICY "Admins can manage account groups" ON public.account_groups FOR ALL USING (public.get_user_role() = 'admin');
CREATE POLICY "Admins can manage chart of accounts" ON public.chart_of_accounts FOR ALL USING (public.get_user_role() = 'admin');