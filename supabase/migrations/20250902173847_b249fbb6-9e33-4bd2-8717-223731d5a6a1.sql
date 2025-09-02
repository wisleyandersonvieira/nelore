-- Create delivery_accounts table
CREATE TABLE public.delivery_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  initial_balance NUMERIC NOT NULL DEFAULT 0,
  initial_balance_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_blocked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create delivery_account_stores table for many-to-many relationship
CREATE TABLE public.delivery_account_stores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  store_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for delivery_accounts
ALTER TABLE public.delivery_accounts ENABLE ROW LEVEL SECURITY;

-- Enable RLS for delivery_account_stores  
ALTER TABLE public.delivery_account_stores ENABLE ROW LEVEL SECURITY;

-- Create policies for delivery_accounts
CREATE POLICY "Users can create delivery accounts with permissions" 
ON public.delivery_accounts 
FOR INSERT 
WITH CHECK (user_has_permission('financeiro'::text, 'write'::permission_type));

CREATE POLICY "Users can view delivery accounts for their store" 
ON public.delivery_accounts 
FOR SELECT 
USING (user_has_permission('financeiro'::text, 'read'::permission_type) AND (
  (get_user_role() = 'admin'::user_role) OR 
  EXISTS (
    SELECT 1 FROM delivery_account_stores das 
    WHERE das.account_id = delivery_accounts.id 
    AND das.store_id = get_user_store_id()
  )
));

CREATE POLICY "Users can update delivery accounts for their store" 
ON public.delivery_accounts 
FOR UPDATE 
USING (user_has_permission('financeiro'::text, 'write'::permission_type) AND (
  (get_user_role() = 'admin'::user_role) OR 
  EXISTS (
    SELECT 1 FROM delivery_account_stores das 
    WHERE das.account_id = delivery_accounts.id 
    AND das.store_id = get_user_store_id()
  )
));

CREATE POLICY "Users can delete delivery accounts for their store" 
ON public.delivery_accounts 
FOR DELETE 
USING (user_has_permission('financeiro'::text, 'write'::permission_type) AND (
  (get_user_role() = 'admin'::user_role) OR 
  EXISTS (
    SELECT 1 FROM delivery_account_stores das 
    WHERE das.account_id = delivery_accounts.id 
    AND das.store_id = get_user_store_id()
  )
));

-- Create policies for delivery_account_stores
CREATE POLICY "Users can create delivery account store associations" 
ON public.delivery_account_stores 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated'::text);

CREATE POLICY "Users can view delivery account store associations" 
ON public.delivery_account_stores 
FOR SELECT 
USING (auth.role() = 'authenticated'::text);

CREATE POLICY "Users can update delivery account store associations" 
ON public.delivery_account_stores 
FOR UPDATE 
USING (auth.role() = 'authenticated'::text);

CREATE POLICY "Users can delete delivery account store associations" 
ON public.delivery_account_stores 
FOR DELETE 
USING (auth.role() = 'authenticated'::text);

-- Add trigger for automatic timestamp updates
CREATE TRIGGER update_delivery_accounts_updated_at
BEFORE UPDATE ON public.delivery_accounts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();