-- Modificar a tabela cash_control para incluir os novos campos
ALTER TABLE public.cash_control 
ADD COLUMN IF NOT EXISTS saldo_inicial NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS contagem_dinheiro NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS despesas_pagas NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS valor_mantido_caixa NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS faturamento_dinheiro NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS faturamento_cartao NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS faturamento_conta NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS faturamento_delivery NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS faturamento_total NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS valor_fechamento_pdv NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS diferenca NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS anexos JSONB DEFAULT '[]'::jsonb;

-- Criar tabela para itens de cartão do caixa
CREATE TABLE IF NOT EXISTS public.cash_control_card_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cash_control_id UUID NOT NULL REFERENCES public.cash_control(id) ON DELETE CASCADE,
  card_account_id UUID NOT NULL REFERENCES public.card_accounts(id) ON DELETE CASCADE,
  valor NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela para itens de conta corrente do caixa
CREATE TABLE IF NOT EXISTS public.cash_control_account_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cash_control_id UUID NOT NULL REFERENCES public.cash_control(id) ON DELETE CASCADE,
  current_account_id UUID NOT NULL REFERENCES public.current_accounts(id) ON DELETE CASCADE,
  valor NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela para itens de delivery do caixa
CREATE TABLE IF NOT EXISTS public.cash_control_delivery_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cash_control_id UUID NOT NULL REFERENCES public.cash_control(id) ON DELETE CASCADE,
  delivery_account_id UUID NOT NULL REFERENCES public.delivery_accounts(id) ON DELETE CASCADE,
  valor NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS nas novas tabelas
ALTER TABLE public.cash_control_card_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_control_account_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_control_delivery_items ENABLE ROW LEVEL SECURITY;

-- Criar políticas RLS para cash_control_card_items
CREATE POLICY "Users can manage card items for their store cash control" 
ON public.cash_control_card_items 
FOR ALL 
USING (
  user_has_permission('caixa'::text, 'write'::permission_type) AND 
  EXISTS (
    SELECT 1 FROM public.cash_control cc 
    WHERE cc.id = cash_control_card_items.cash_control_id 
    AND ((get_user_role() = 'admin'::user_role) OR (cc.store_id = get_user_store_id()))
  )
);

CREATE POLICY "Users can view card items for their store cash control" 
ON public.cash_control_card_items 
FOR SELECT 
USING (
  user_has_permission('caixa'::text, 'read'::permission_type) AND 
  EXISTS (
    SELECT 1 FROM public.cash_control cc 
    WHERE cc.id = cash_control_card_items.cash_control_id 
    AND ((get_user_role() = 'admin'::user_role) OR (cc.store_id = get_user_store_id()))
  )
);

-- Criar políticas RLS para cash_control_account_items
CREATE POLICY "Users can manage account items for their store cash control" 
ON public.cash_control_account_items 
FOR ALL 
USING (
  user_has_permission('caixa'::text, 'write'::permission_type) AND 
  EXISTS (
    SELECT 1 FROM public.cash_control cc 
    WHERE cc.id = cash_control_account_items.cash_control_id 
    AND ((get_user_role() = 'admin'::user_role) OR (cc.store_id = get_user_store_id()))
  )
);

CREATE POLICY "Users can view account items for their store cash control" 
ON public.cash_control_account_items 
FOR SELECT 
USING (
  user_has_permission('caixa'::text, 'read'::permission_type) AND 
  EXISTS (
    SELECT 1 FROM public.cash_control cc 
    WHERE cc.id = cash_control_account_items.cash_control_id 
    AND ((get_user_role() = 'admin'::user_role) OR (cc.store_id = get_user_store_id()))
  )
);

-- Criar políticas RLS para cash_control_delivery_items
CREATE POLICY "Users can manage delivery items for their store cash control" 
ON public.cash_control_delivery_items 
FOR ALL 
USING (
  user_has_permission('caixa'::text, 'write'::permission_type) AND 
  EXISTS (
    SELECT 1 FROM public.cash_control cc 
    WHERE cc.id = cash_control_delivery_items.cash_control_id 
    AND ((get_user_role() = 'admin'::user_role) OR (cc.store_id = get_user_store_id()))
  )
);

CREATE POLICY "Users can view delivery items for their store cash control" 
ON public.cash_control_delivery_items 
FOR SELECT 
USING (
  user_has_permission('caixa'::text, 'read'::permission_type) AND 
  EXISTS (
    SELECT 1 FROM public.cash_control cc 
    WHERE cc.id = cash_control_delivery_items.cash_control_id 
    AND ((get_user_role() = 'admin'::user_role) OR (cc.store_id = get_user_store_id()))
  )
);

-- Adicionar triggers para atualização de timestamp
CREATE TRIGGER update_cash_control_card_items_updated_at
BEFORE UPDATE ON public.cash_control_card_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cash_control_account_items_updated_at
BEFORE UPDATE ON public.cash_control_account_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cash_control_delivery_items_updated_at
BEFORE UPDATE ON public.cash_control_delivery_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();