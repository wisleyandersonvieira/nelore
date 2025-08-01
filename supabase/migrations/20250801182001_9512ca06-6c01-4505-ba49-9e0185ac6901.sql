-- Create enum types
CREATE TYPE public.user_role AS ENUM ('admin', 'manager', 'operator', 'viewer');
CREATE TYPE public.permission_type AS ENUM ('read', 'write', 'admin');
CREATE TYPE public.transaction_type AS ENUM ('entrada', 'saida');
CREATE TYPE public.account_type AS ENUM ('receita', 'despesa', 'ativo', 'passivo');

-- Create stores (cost centers) table
CREATE TABLE public.stores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  address TEXT,
  phone TEXT,
  manager_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'viewer',
  store_id UUID REFERENCES public.stores(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user permissions table
CREATE TABLE public.user_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  module TEXT NOT NULL, -- 'caixa', 'contas_pagar', 'contas_receber', 'produtos', etc
  permission permission_type NOT NULL,
  store_id UUID REFERENCES public.stores(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, module, store_id)
);

-- Create suppliers table
CREATE TABLE public.suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  cnpj_cpf TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  contact_person TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create account groups table
CREATE TABLE public.account_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  parent_id UUID REFERENCES public.account_groups(id),
  account_type account_type NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create chart of accounts table
CREATE TABLE public.chart_of_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  group_id UUID NOT NULL REFERENCES public.account_groups(id),
  account_type account_type NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create products table
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT UNIQUE,
  description TEXT,
  unit_price DECIMAL(10,2),
  cost_price DECIMAL(10,2),
  category TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create cash control table
CREATE TABLE public.cash_control (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id),
  date DATE NOT NULL,
  opening_balance DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_sales DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_expenses DECIMAL(10,2) NOT NULL DEFAULT 0,
  closing_balance DECIMAL(10,2) NOT NULL DEFAULT 0,
  notes TEXT,
  image_urls TEXT[],
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(store_id, date)
);

-- Create accounts payable table
CREATE TABLE public.accounts_payable (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id),
  supplier_id UUID REFERENCES public.suppliers(id),
  account_id UUID NOT NULL REFERENCES public.chart_of_accounts(id),
  description TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  due_date DATE NOT NULL,
  payment_date DATE,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'paid', 'overdue'
  notes TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create accounts receivable table
CREATE TABLE public.accounts_receivable (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id),
  account_id UUID NOT NULL REFERENCES public.chart_of_accounts(id),
  description TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  due_date DATE NOT NULL,
  payment_date DATE,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'received', 'overdue'
  notes TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create financial transactions table
CREATE TABLE public.financial_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id),
  account_id UUID NOT NULL REFERENCES public.chart_of_accounts(id),
  transaction_type transaction_type NOT NULL,
  description TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  transaction_date DATE NOT NULL,
  reference_id UUID, -- Link to cash_control, accounts_payable, etc
  reference_type TEXT, -- 'cash_control', 'accounts_payable', 'accounts_receivable'
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_control ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts_payable ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts_receivable ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_stores_updated_at BEFORE UPDATE ON public.stores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_chart_of_accounts_updated_at BEFORE UPDATE ON public.chart_of_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_cash_control_updated_at BEFORE UPDATE ON public.cash_control FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_accounts_payable_updated_at BEFORE UPDATE ON public.accounts_payable FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_accounts_receivable_updated_at BEFORE UPDATE ON public.accounts_receivable FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'name', NEW.email),
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user registration
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create security definer functions for RLS
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS user_role AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.get_user_store_id()
RETURNS UUID AS $$
  SELECT store_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.user_has_permission(module_name TEXT, required_permission permission_type)
RETURNS BOOLEAN AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Create RLS policies for profiles
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.get_user_role() = 'admin');
CREATE POLICY "Admins can manage all profiles" ON public.profiles FOR ALL USING (public.get_user_role() = 'admin');

-- Create RLS policies for stores
CREATE POLICY "Users can view their store" ON public.stores FOR SELECT USING (
  public.get_user_role() = 'admin' OR id = public.get_user_store_id()
);
CREATE POLICY "Admins can manage stores" ON public.stores FOR ALL USING (public.get_user_role() = 'admin');

-- Create RLS policies for user_permissions
CREATE POLICY "Admins can manage permissions" ON public.user_permissions FOR ALL USING (public.get_user_role() = 'admin');
CREATE POLICY "Users can view own permissions" ON public.user_permissions FOR SELECT USING (user_id = auth.uid());

-- Create RLS policies for cash_control
CREATE POLICY "Users can view cash control for their store" ON public.cash_control FOR SELECT USING (
  public.user_has_permission('caixa', 'read') AND 
  (public.get_user_role() = 'admin' OR store_id = public.get_user_store_id())
);
CREATE POLICY "Users can manage cash control for their store" ON public.cash_control FOR ALL USING (
  public.user_has_permission('caixa', 'write') AND 
  (public.get_user_role() = 'admin' OR store_id = public.get_user_store_id())
);

-- Create RLS policies for accounts_payable
CREATE POLICY "Users can view accounts payable for their store" ON public.accounts_payable FOR SELECT USING (
  public.user_has_permission('contas_pagar', 'read') AND 
  (public.get_user_role() = 'admin' OR store_id = public.get_user_store_id())
);
CREATE POLICY "Users can manage accounts payable for their store" ON public.accounts_payable FOR ALL USING (
  public.user_has_permission('contas_pagar', 'write') AND 
  (public.get_user_role() = 'admin' OR store_id = public.get_user_store_id())
);

-- Create RLS policies for accounts_receivable
CREATE POLICY "Users can view accounts receivable for their store" ON public.accounts_receivable FOR SELECT USING (
  public.user_has_permission('contas_receber', 'read') AND 
  (public.get_user_role() = 'admin' OR store_id = public.get_user_store_id())
);
CREATE POLICY "Users can manage accounts receivable for their store" ON public.accounts_receivable FOR ALL USING (
  public.user_has_permission('contas_receber', 'write') AND 
  (public.get_user_role() = 'admin' OR store_id = public.get_user_store_id())
);

-- Create RLS policies for financial_transactions
CREATE POLICY "Users can view transactions for their store" ON public.financial_transactions FOR SELECT USING (
  public.user_has_permission('financeiro', 'read') AND 
  (public.get_user_role() = 'admin' OR store_id = public.get_user_store_id())
);
CREATE POLICY "Users can create transactions for their store" ON public.financial_transactions FOR INSERT WITH CHECK (
  public.user_has_permission('financeiro', 'write') AND 
  (public.get_user_role() = 'admin' OR store_id = public.get_user_store_id()) AND
  created_by = auth.uid()
);

-- Create RLS policies for suppliers (global data)
CREATE POLICY "Users can view suppliers" ON public.suppliers FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users with permission can manage suppliers" ON public.suppliers FOR ALL USING (
  public.user_has_permission('fornecedores', 'write')
);

-- Create RLS policies for account_groups (global data)
CREATE POLICY "Users can view account groups" ON public.account_groups FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can manage account groups" ON public.account_groups FOR ALL USING (public.get_user_role() = 'admin');

-- Create RLS policies for chart_of_accounts (global data)
CREATE POLICY "Users can view chart of accounts" ON public.chart_of_accounts FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can manage chart of accounts" ON public.chart_of_accounts FOR ALL USING (public.get_user_role() = 'admin');

-- Create RLS policies for products (global data)
CREATE POLICY "Users can view products" ON public.products FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users with permission can manage products" ON public.products FOR ALL USING (
  public.user_has_permission('produtos', 'write')
);

-- Insert default account groups
INSERT INTO public.account_groups (name, code, account_type) VALUES
('Receitas', '3', 'receita'),
('Receita de Vendas', '3.1', 'receita'),
('Outras Receitas', '3.2', 'receita'),
('Despesas', '4', 'despesa'),
('Despesas Operacionais', '4.1', 'despesa'),
('Despesas Administrativas', '4.2', 'despesa'),
('Ativo', '1', 'ativo'),
('Ativo Circulante', '1.1', 'ativo'),
('Passivo', '2', 'passivo'),
('Passivo Circulante', '2.1', 'passivo');

-- Update account groups with parent relationships
UPDATE public.account_groups SET parent_id = (SELECT id FROM public.account_groups WHERE code = '3') WHERE code = '3.1';
UPDATE public.account_groups SET parent_id = (SELECT id FROM public.account_groups WHERE code = '3') WHERE code = '3.2';
UPDATE public.account_groups SET parent_id = (SELECT id FROM public.account_groups WHERE code = '4') WHERE code = '4.1';
UPDATE public.account_groups SET parent_id = (SELECT id FROM public.account_groups WHERE code = '4') WHERE code = '4.2';
UPDATE public.account_groups SET parent_id = (SELECT id FROM public.account_groups WHERE code = '1') WHERE code = '1.1';
UPDATE public.account_groups SET parent_id = (SELECT id FROM public.account_groups WHERE code = '2') WHERE code = '2.1';

-- Insert default chart of accounts
INSERT INTO public.chart_of_accounts (name, code, group_id, account_type) VALUES
('Vendas de Sorvetes', '3.1.001', (SELECT id FROM public.account_groups WHERE code = '3.1'), 'receita'),
('Receita de Serviços', '3.1.002', (SELECT id FROM public.account_groups WHERE code = '3.1'), 'receita'),
('Receitas Financeiras', '3.2.001', (SELECT id FROM public.account_groups WHERE code = '3.2'), 'receita'),
('Compra de Mercadorias', '4.1.001', (SELECT id FROM public.account_groups WHERE code = '4.1'), 'despesa'),
('Energia Elétrica', '4.1.002', (SELECT id FROM public.account_groups WHERE code = '4.1'), 'despesa'),
('Aluguel', '4.1.003', (SELECT id FROM public.account_groups WHERE code = '4.1'), 'despesa'),
('Salários', '4.2.001', (SELECT id FROM public.account_groups WHERE code = '4.2'), 'despesa'),
('Encargos Sociais', '4.2.002', (SELECT id FROM public.account_groups WHERE code = '4.2'), 'despesa'),
('Caixa', '1.1.001', (SELECT id FROM public.account_groups WHERE code = '1.1'), 'ativo'),
('Contas a Receber', '1.1.002', (SELECT id FROM public.account_groups WHERE code = '1.1'), 'ativo'),
('Fornecedores', '2.1.001', (SELECT id FROM public.account_groups WHERE code = '2.1'), 'passivo'),
('Contas a Pagar', '2.1.002', (SELECT id FROM public.account_groups WHERE code = '2.1'), 'passivo');