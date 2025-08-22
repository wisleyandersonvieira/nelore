-- Create storage policies for account-documents bucket
-- Users need to be able to upload, view, and manage their account documents

-- Policy for uploading documents - users can upload to their store folder
CREATE POLICY "Users can upload account documents for their store" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'account-documents' 
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1]::uuid = get_user_store_id()
);

-- Policy for viewing documents - users can view documents from their store
CREATE POLICY "Users can view account documents for their store" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'account-documents' 
  AND auth.role() = 'authenticated'
  AND (
    get_user_role() = 'admin'::user_role 
    OR (storage.foldername(name))[1]::uuid = get_user_store_id()
  )
);

-- Policy for updating documents - users can update documents from their store
CREATE POLICY "Users can update account documents for their store" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'account-documents' 
  AND auth.role() = 'authenticated'
  AND (
    get_user_role() = 'admin'::user_role 
    OR (storage.foldername(name))[1]::uuid = get_user_store_id()
  )
);

-- Policy for deleting documents - users can delete documents from their store
CREATE POLICY "Users can delete account documents for their store" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'account-documents' 
  AND auth.role() = 'authenticated'
  AND (
    get_user_role() = 'admin'::user_role 
    OR (storage.foldername(name))[1]::uuid = get_user_store_id()
  )
);