-- Adicionar campos necessários para contas a pagar e contas a receber

-- Adicionar campos para contas a pagar
ALTER TABLE public.accounts_payable 
ADD COLUMN IF NOT EXISTS document_type TEXT,
ADD COLUMN IF NOT EXISTS document_number TEXT,
ADD COLUMN IF NOT EXISTS issue_date DATE,
ADD COLUMN IF NOT EXISTS total_amount NUMERIC DEFAULT 0;

-- Adicionar campos para contas a receber  
ALTER TABLE public.accounts_receivable
ADD COLUMN IF NOT EXISTS document_type TEXT,
ADD COLUMN IF NOT EXISTS document_number TEXT,
ADD COLUMN IF NOT EXISTS issue_date DATE,
ADD COLUMN IF NOT EXISTS total_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS creditor_id UUID REFERENCES public.creditors(id);

-- Criar tabela para itens das contas a pagar
CREATE TABLE IF NOT EXISTS public.accounts_payable_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_payable_id UUID NOT NULL REFERENCES public.accounts_payable(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id),
    quantity NUMERIC NOT NULL DEFAULT 1,
    unit_price NUMERIC NOT NULL DEFAULT 0,
    total_price NUMERIC NOT NULL DEFAULT 0,
    store_id UUID NOT NULL REFERENCES public.stores(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela para itens das contas a receber
CREATE TABLE IF NOT EXISTS public.accounts_receivable_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_receivable_id UUID NOT NULL REFERENCES public.accounts_receivable(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id),
    quantity NUMERIC NOT NULL DEFAULT 1,
    unit_price NUMERIC NOT NULL DEFAULT 0,
    total_price NUMERIC NOT NULL DEFAULT 0,
    store_id UUID NOT NULL REFERENCES public.stores(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS nas novas tabelas
ALTER TABLE public.accounts_payable_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts_receivable_items ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para accounts_payable_items
CREATE POLICY "Users can manage payable items for their store" 
ON public.accounts_payable_items 
FOR ALL 
USING (
    user_has_permission('contas_pagar', 'write') AND 
    (get_user_role() = 'admin' OR store_id = get_user_store_id())
);

CREATE POLICY "Users can view payable items for their store" 
ON public.accounts_payable_items 
FOR SELECT 
USING (
    user_has_permission('contas_pagar', 'read') AND 
    (get_user_role() = 'admin' OR store_id = get_user_store_id())
);

-- Políticas RLS para accounts_receivable_items
CREATE POLICY "Users can manage receivable items for their store" 
ON public.accounts_receivable_items 
FOR ALL 
USING (
    user_has_permission('contas_receber', 'write') AND 
    (get_user_role() = 'admin' OR store_id = get_user_store_id())
);

CREATE POLICY "Users can view receivable items for their store" 
ON public.accounts_receivable_items 
FOR SELECT 
USING (
    user_has_permission('contas_receber', 'read') AND 
    (get_user_role() = 'admin' OR store_id = get_user_store_id())
);