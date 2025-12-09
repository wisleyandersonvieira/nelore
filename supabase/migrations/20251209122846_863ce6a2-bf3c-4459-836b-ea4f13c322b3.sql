-- Tornar store_id nullable na tabela suppliers para permitir fornecedores globais
ALTER TABLE public.suppliers ALTER COLUMN store_id DROP NOT NULL;

-- Atualizar políticas RLS para fornecedores globais
DROP POLICY IF EXISTS "Users can view suppliers for their store" ON public.suppliers;
DROP POLICY IF EXISTS "Users can create suppliers for their store" ON public.suppliers;
DROP POLICY IF EXISTS "Users can update suppliers for their store" ON public.suppliers;
DROP POLICY IF EXISTS "Users can delete suppliers for their store" ON public.suppliers;

-- Fornecedores globais: todos os usuários autenticados podem ver
CREATE POLICY "Users can view all suppliers" 
ON public.suppliers 
FOR SELECT 
USING (auth.role() = 'authenticated'::text);

-- Usuários autenticados podem criar fornecedores globais
CREATE POLICY "Users can create suppliers" 
ON public.suppliers 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated'::text);

-- Usuários autenticados podem atualizar fornecedores
CREATE POLICY "Users can update suppliers" 
ON public.suppliers 
FOR UPDATE 
USING (auth.role() = 'authenticated'::text);

-- Usuários autenticados podem deletar fornecedores
CREATE POLICY "Users can delete suppliers" 
ON public.suppliers 
FOR DELETE 
USING (auth.role() = 'authenticated'::text);