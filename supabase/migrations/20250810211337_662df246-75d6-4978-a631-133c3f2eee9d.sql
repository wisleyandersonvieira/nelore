-- Create current_accounts table
CREATE TABLE public.current_accounts (
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

-- Create current_account_stores junction table for store associations
CREATE TABLE public.current_account_stores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.current_accounts(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(account_id, store_id)
);

-- Enable RLS
ALTER TABLE public.current_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.current_account_stores ENABLE ROW LEVEL SECURITY;

-- RLS policies for current_accounts
CREATE POLICY "Users can view current accounts for their stores" 
ON public.current_accounts 
FOR SELECT 
USING (
  get_user_role() = 'admin'::user_role OR
  EXISTS (
    SELECT 1 FROM public.current_account_stores cas
    INNER JOIN public.user_stores us ON cas.store_id = us.store_id
    WHERE cas.account_id = current_accounts.id 
    AND us.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can manage all current accounts" 
ON public.current_accounts 
FOR ALL 
USING (get_user_role() = 'admin'::user_role);

-- RLS policies for current_account_stores
CREATE POLICY "Users can view account store associations for their stores" 
ON public.current_account_stores 
FOR SELECT 
USING (
  get_user_role() = 'admin'::user_role OR
  EXISTS (
    SELECT 1 FROM public.user_stores us
    WHERE us.store_id = current_account_stores.store_id 
    AND us.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can manage account store associations" 
ON public.current_account_stores 
FOR ALL 
USING (get_user_role() = 'admin'::user_role);

-- Add updated_at trigger
CREATE TRIGGER update_current_accounts_updated_at
BEFORE UPDATE ON public.current_accounts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();