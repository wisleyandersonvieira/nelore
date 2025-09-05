-- Create table for cash control cash items (similar to card, account, and delivery items)
CREATE TABLE public.cash_control_cash_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cash_control_id UUID NOT NULL,
  cash_account_id UUID NOT NULL,
  valor NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.cash_control_cash_items ENABLE ROW LEVEL SECURITY;

-- Create policies for cash items
CREATE POLICY "Users can manage cash items for their store cash control" 
ON public.cash_control_cash_items 
FOR ALL 
USING (
  user_has_permission('caixa', 'write'::permission_type) AND
  EXISTS (
    SELECT 1 FROM cash_control cc 
    WHERE cc.id = cash_control_cash_items.cash_control_id 
    AND (get_user_role() = 'admin'::user_role OR cc.store_id = get_user_store_id())
  )
);

CREATE POLICY "Users can view cash items for their store cash control" 
ON public.cash_control_cash_items 
FOR SELECT 
USING (
  user_has_permission('caixa', 'read'::permission_type) AND
  EXISTS (
    SELECT 1 FROM cash_control cc 
    WHERE cc.id = cash_control_cash_items.cash_control_id 
    AND (get_user_role() = 'admin'::user_role OR cc.store_id = get_user_store_id())
  )
);

-- Add trigger for automatic timestamp updates
CREATE TRIGGER update_cash_control_cash_items_updated_at
BEFORE UPDATE ON public.cash_control_cash_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();