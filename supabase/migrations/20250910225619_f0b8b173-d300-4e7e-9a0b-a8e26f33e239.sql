-- Criar enum para tipos de bloqueio
CREATE TYPE block_type AS ENUM ('competencia', 'pagamento');

-- Criar tabela para controle de períodos bloqueados
CREATE TABLE public.period_blocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  block_type block_type NOT NULL,
  blocked_modules TEXT[] NOT NULL DEFAULT '{}',
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Constraint para garantir que mês seja válido
  CONSTRAINT valid_month CHECK (month >= 1 AND month <= 12),
  
  -- Constraint única para evitar duplicatas
  UNIQUE(store_id, year, month, block_type)
);

-- Habilitar RLS
ALTER TABLE public.period_blocks ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para controle de períodos
CREATE POLICY "Users can create period blocks for their store" 
ON public.period_blocks 
FOR INSERT 
WITH CHECK (
  user_has_permission('financeiro'::text, 'write'::permission_type) 
  AND ((get_user_role() = 'admin'::user_role) OR (store_id = get_user_store_id()))
  AND (created_by = auth.uid())
);

CREATE POLICY "Users can view period blocks for their store" 
ON public.period_blocks 
FOR SELECT 
USING (
  user_has_permission('financeiro'::text, 'read'::permission_type) 
  AND ((get_user_role() = 'admin'::user_role) OR (store_id = get_user_store_id()))
);

CREATE POLICY "Users can update period blocks for their store" 
ON public.period_blocks 
FOR UPDATE 
USING (
  user_has_permission('financeiro'::text, 'write'::permission_type) 
  AND ((get_user_role() = 'admin'::user_role) OR (store_id = get_user_store_id()))
);

CREATE POLICY "Users can delete period blocks for their store" 
ON public.period_blocks 
FOR DELETE 
USING (
  user_has_permission('financeiro'::text, 'write'::permission_type) 
  AND ((get_user_role() = 'admin'::user_role) OR (store_id = get_user_store_id()))
);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_period_blocks_updated_at
BEFORE UPDATE ON public.period_blocks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();