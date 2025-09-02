-- Create cash_accounts table
CREATE TABLE public.cash_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  bank TEXT NOT NULL,
  account_number TEXT NOT NULL,
  initial_balance NUMERIC NOT NULL DEFAULT 0,
  initial_balance_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_blocked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create card_accounts table
CREATE TABLE public.card_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  bank TEXT NOT NULL,
  account_number TEXT NOT NULL,
  initial_balance NUMERIC NOT NULL DEFAULT 0,
  initial_balance_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_blocked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create cash_account_stores junction table
CREATE TABLE public.cash_account_stores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.cash_accounts(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(account_id, store_id)
);

-- Create card_account_stores junction table
CREATE TABLE public.card_account_stores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.card_accounts(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(account_id, store_id)
);

-- Enable RLS on all tables
ALTER TABLE public.cash_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_account_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_account_stores ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for cash_accounts
CREATE POLICY "Users can create cash accounts with permissions" 
ON public.cash_accounts 
FOR INSERT 
WITH CHECK (user_has_permission('financeiro'::text, 'write'::permission_type));

CREATE POLICY "Users can view cash accounts for their store" 
ON public.cash_accounts 
FOR SELECT 
USING (user_has_permission('financeiro'::text, 'read'::permission_type) AND (
  get_user_role() = 'admin'::user_role OR 
  EXISTS (
    SELECT 1 FROM public.cash_account_stores cas 
    WHERE cas.account_id = cash_accounts.id 
    AND cas.store_id = get_user_store_id()
  )
));

CREATE POLICY "Users can update cash accounts for their store" 
ON public.cash_accounts 
FOR UPDATE 
USING (user_has_permission('financeiro'::text, 'write'::permission_type) AND (
  get_user_role() = 'admin'::user_role OR 
  EXISTS (
    SELECT 1 FROM public.cash_account_stores cas 
    WHERE cas.account_id = cash_accounts.id 
    AND cas.store_id = get_user_store_id()
  )
));

CREATE POLICY "Users can delete cash accounts for their store" 
ON public.cash_accounts 
FOR DELETE 
USING (user_has_permission('financeiro'::text, 'write'::permission_type) AND (
  get_user_role() = 'admin'::user_role OR 
  EXISTS (
    SELECT 1 FROM public.cash_account_stores cas 
    WHERE cas.account_id = cash_accounts.id 
    AND cas.store_id = get_user_store_id()
  )
));

-- Create RLS policies for card_accounts
CREATE POLICY "Users can create card accounts with permissions" 
ON public.card_accounts 
FOR INSERT 
WITH CHECK (user_has_permission('financeiro'::text, 'write'::permission_type));

CREATE POLICY "Users can view card accounts for their store" 
ON public.card_accounts 
FOR SELECT 
USING (user_has_permission('financeiro'::text, 'read'::permission_type) AND (
  get_user_role() = 'admin'::user_role OR 
  EXISTS (
    SELECT 1 FROM public.card_account_stores cas 
    WHERE cas.account_id = card_accounts.id 
    AND cas.store_id = get_user_store_id()
  )
));

CREATE POLICY "Users can update card accounts for their store" 
ON public.card_accounts 
FOR UPDATE 
USING (user_has_permission('financeiro'::text, 'write'::permission_type) AND (
  get_user_role() = 'admin'::user_role OR 
  EXISTS (
    SELECT 1 FROM public.card_account_stores cas 
    WHERE cas.account_id = card_accounts.id 
    AND cas.store_id = get_user_store_id()
  )
));

CREATE POLICY "Users can delete card accounts for their store" 
ON public.card_accounts 
FOR DELETE 
USING (user_has_permission('financeiro'::text, 'write'::permission_type) AND (
  get_user_role() = 'admin'::user_role OR 
  EXISTS (
    SELECT 1 FROM public.card_account_stores cas 
    WHERE cas.account_id = card_accounts.id 
    AND cas.store_id = get_user_store_id()
  )
));

-- Create RLS policies for junction tables
CREATE POLICY "Users can create cash account store associations" 
ON public.cash_account_stores 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated'::text);

CREATE POLICY "Users can view cash account store associations" 
ON public.cash_account_stores 
FOR SELECT 
USING (auth.role() = 'authenticated'::text);

CREATE POLICY "Users can update cash account store associations" 
ON public.cash_account_stores 
FOR UPDATE 
USING (auth.role() = 'authenticated'::text);

CREATE POLICY "Users can delete cash account store associations" 
ON public.cash_account_stores 
FOR DELETE 
USING (auth.role() = 'authenticated'::text);

CREATE POLICY "Users can create card account store associations" 
ON public.card_account_stores 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated'::text);

CREATE POLICY "Users can view card account store associations" 
ON public.card_account_stores 
FOR SELECT 
USING (auth.role() = 'authenticated'::text);

CREATE POLICY "Users can update card account store associations" 
ON public.card_account_stores 
FOR UPDATE 
USING (auth.role() = 'authenticated'::text);

CREATE POLICY "Users can delete card account store associations" 
ON public.card_account_stores 
FOR DELETE 
USING (auth.role() = 'authenticated'::text);

-- Add update triggers for timestamp columns
CREATE TRIGGER update_cash_accounts_updated_at
BEFORE UPDATE ON public.cash_accounts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_card_accounts_updated_at
BEFORE UPDATE ON public.card_accounts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();