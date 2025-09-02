-- Criar políticas para o bucket account-documents permitir upload e visualização de anexos do caixa
CREATE POLICY "Users can upload cash control attachments" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'account-documents' 
  AND (storage.foldername(name))[1] = 'cash-control'
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Users can view cash control attachments" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'account-documents' 
  AND (storage.foldername(name))[1] = 'cash-control'
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Users can delete cash control attachments" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'account-documents' 
  AND (storage.foldername(name))[1] = 'cash-control'
  AND auth.uid() = owner_id
);