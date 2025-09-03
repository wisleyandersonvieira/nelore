-- Criar tabela para controle de estoque
CREATE TABLE public.stock_control (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  total_value NUMERIC NOT NULL DEFAULT 0,
  notes TEXT
);

-- Criar tabela para itens do estoque
CREATE TABLE public.stock_control_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stock_control_id UUID NOT NULL,
  product_id UUID NOT NULL,
  category TEXT NOT NULL, -- 'sorvete', 'mercadorias', 'embalagens'
  quantity NUMERIC NOT NULL DEFAULT 0,
  unit_cost NUMERIC NOT NULL DEFAULT 0,
  total_cost NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.stock_control ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_control_items ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para stock_control
CREATE POLICY "Users can manage stock control for their store"
ON public.stock_control
FOR ALL
USING (
  user_has_permission('estoque'::text, 'write'::permission_type) AND
  (
    get_user_role() = 'admin'::user_role OR 
    store_id = get_user_store_id()
  )
);

CREATE POLICY "Users can view stock control for their store"
ON public.stock_control
FOR SELECT
USING (
  user_has_permission('estoque'::text, 'read'::permission_type) AND
  (
    get_user_role() = 'admin'::user_role OR 
    store_id = get_user_store_id()
  )
);

-- Políticas RLS para stock_control_items
CREATE POLICY "Users can manage stock items for their store"
ON public.stock_control_items
FOR ALL
USING (
  user_has_permission('estoque'::text, 'write'::permission_type) AND
  EXISTS (
    SELECT 1 FROM stock_control sc
    WHERE sc.id = stock_control_items.stock_control_id
    AND (
      get_user_role() = 'admin'::user_role OR 
      sc.store_id = get_user_store_id()
    )
  )
);

CREATE POLICY "Users can view stock items for their store"
ON public.stock_control_items
FOR SELECT
USING (
  user_has_permission('estoque'::text, 'read'::permission_type) AND
  EXISTS (
    SELECT 1 FROM stock_control sc
    WHERE sc.id = stock_control_items.stock_control_id
    AND (
      get_user_role() = 'admin'::user_role OR 
      sc.store_id = get_user_store_id()
    )
  )
);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_stock_control_updated_at
BEFORE UPDATE ON public.stock_control
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_stock_control_items_updated_at
BEFORE UPDATE ON public.stock_control_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para performance
CREATE INDEX idx_stock_control_store_date ON public.stock_control(store_id, year, month);
CREATE INDEX idx_stock_control_items_stock_id ON public.stock_control_items(stock_control_id);

-- Constraint para evitar duplicatas
ALTER TABLE public.stock_control 
ADD CONSTRAINT unique_stock_control_store_month_year 
UNIQUE (store_id, month, year);