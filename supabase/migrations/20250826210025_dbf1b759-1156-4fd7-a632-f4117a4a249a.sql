-- Criar tabelas para DRE (Demonstrativo de Resultados do Exercício)

-- Tabela de estruturas DRE
CREATE TABLE public.dre_structures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES profiles(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de itens da estrutura DRE (grupos e subgrupos)
CREATE TABLE public.dre_structure_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  structure_id UUID NOT NULL REFERENCES dre_structures(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('group', 'subgroup', 'sum_line')),
  account_group_id UUID REFERENCES account_groups(id),
  parent_id UUID REFERENCES dre_structure_items(id),
  name TEXT NOT NULL,
  operation_type TEXT NOT NULL CHECK (operation_type IN ('credit', 'debit')) DEFAULT 'credit',
  position_order INTEGER NOT NULL,
  sum_items UUID[] DEFAULT '{}', -- IDs dos itens a somar (para sum_line)
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de cadastros DRE
CREATE TABLE public.dre_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  structure_id UUID NOT NULL REFERENCES dre_structures(id),
  store_id UUID NOT NULL REFERENCES stores(id),
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  year INTEGER NOT NULL,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(structure_id, store_id, month, year)
);

-- Tabela de valores dos subgrupos DRE
CREATE TABLE public.dre_entry_values (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_id UUID NOT NULL REFERENCES dre_entries(id) ON DELETE CASCADE,
  structure_item_id UUID NOT NULL REFERENCES dre_structure_items(id),
  value NUMERIC NOT NULL DEFAULT 0,
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(entry_id, structure_item_id)
);

-- Enable RLS
ALTER TABLE public.dre_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dre_structure_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dre_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dre_entry_values ENABLE ROW LEVEL SECURITY;

-- RLS Policies para dre_structures
CREATE POLICY "Users can view DRE structures" 
ON public.dre_structures 
FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Users can create DRE structures" 
ON public.dre_structures 
FOR INSERT 
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own DRE structures" 
ON public.dre_structures 
FOR UPDATE 
USING (auth.uid() = created_by);

CREATE POLICY "Users can delete own DRE structures" 
ON public.dre_structures 
FOR DELETE 
USING (auth.uid() = created_by);

-- RLS Policies para dre_structure_items
CREATE POLICY "Users can view DRE structure items" 
ON public.dre_structure_items 
FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Users can manage DRE structure items" 
ON public.dre_structure_items 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM dre_structures ds 
  WHERE ds.id = structure_id AND ds.created_by = auth.uid()
));

-- RLS Policies para dre_entries
CREATE POLICY "Users can view DRE entries for their store" 
ON public.dre_entries 
FOR SELECT 
USING (
  get_user_role() = 'admin' OR 
  store_id = get_user_store_id()
);

CREATE POLICY "Users can create DRE entries for their store" 
ON public.dre_entries 
FOR INSERT 
WITH CHECK (
  (get_user_role() = 'admin' OR store_id = get_user_store_id()) 
  AND auth.uid() = created_by
);

CREATE POLICY "Users can update DRE entries for their store" 
ON public.dre_entries 
FOR UPDATE 
USING (
  (get_user_role() = 'admin' OR store_id = get_user_store_id()) 
  AND auth.uid() = created_by
);

CREATE POLICY "Users can delete DRE entries for their store" 
ON public.dre_entries 
FOR DELETE 
USING (
  (get_user_role() = 'admin' OR store_id = get_user_store_id()) 
  AND auth.uid() = created_by
);

-- RLS Policies para dre_entry_values
CREATE POLICY "Users can view DRE entry values" 
ON public.dre_entry_values 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM dre_entries de 
  WHERE de.id = entry_id AND (
    get_user_role() = 'admin' OR 
    de.store_id = get_user_store_id()
  )
));

CREATE POLICY "Users can manage DRE entry values" 
ON public.dre_entry_values 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM dre_entries de 
  WHERE de.id = entry_id AND (
    get_user_role() = 'admin' OR 
    de.store_id = get_user_store_id()
  ) AND de.created_by = auth.uid()
));

-- Triggers para updated_at
CREATE TRIGGER update_dre_structures_updated_at
  BEFORE UPDATE ON public.dre_structures
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_dre_entries_updated_at
  BEFORE UPDATE ON public.dre_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_dre_entry_values_updated_at
  BEFORE UPDATE ON public.dre_entry_values
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();