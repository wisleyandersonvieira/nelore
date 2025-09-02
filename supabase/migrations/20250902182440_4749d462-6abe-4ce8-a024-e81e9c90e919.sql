-- Verificar se o bucket account-documents existe e criar se necessário
INSERT INTO storage.buckets (id, name, public)
SELECT 'account-documents', 'account-documents', false
WHERE NOT EXISTS (
  SELECT 1 FROM storage.buckets WHERE id = 'account-documents'
);

-- Remover políticas antigas conflitantes se existirem
DROP POLICY IF EXISTS "Users can upload cash control attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can view cash control attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete cash control attachments" ON storage.objects;

-- Criar políticas corretas para o bucket account-documents
CREATE POLICY "Users can upload to account-documents bucket" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'account-documents' 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Users can view account-documents bucket" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'account-documents' 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Users can delete from account-documents bucket" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'account-documents' 
  AND auth.uid() IS NOT NULL
);