-- Fix security issue: obligation-attachments bucket allows cross-store access
-- Update policies to check store_id in the file path (first folder)

-- Drop existing permissive policies
DROP POLICY IF EXISTS "Users can view obligation attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload obligation attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete obligation attachments" ON storage.objects;

-- Create store-based policies for obligation-attachments
CREATE POLICY "Users can view obligation attachments for their store"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'obligation-attachments'
  AND auth.role() = 'authenticated'
  AND (
    get_user_role() = 'admin'::user_role
    OR (storage.foldername(name))[1]::uuid = get_user_store_id()
  )
);

CREATE POLICY "Users can upload obligation attachments for their store"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'obligation-attachments'
  AND auth.role() = 'authenticated'
  AND (
    get_user_role() = 'admin'::user_role
    OR (storage.foldername(name))[1]::uuid = get_user_store_id()
  )
);

CREATE POLICY "Users can delete obligation attachments for their store"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'obligation-attachments'
  AND auth.role() = 'authenticated'
  AND (
    get_user_role() = 'admin'::user_role
    OR (storage.foldername(name))[1]::uuid = get_user_store_id()
  )
);

-- Also fix account-documents INSERT policy to allow admins
DROP POLICY IF EXISTS "Users can upload account documents for their store" ON storage.objects;

CREATE POLICY "Users can upload account documents for their store" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'account-documents' 
  AND auth.role() = 'authenticated'
  AND (
    get_user_role() = 'admin'::user_role 
    OR (storage.foldername(name))[1]::uuid = get_user_store_id()
  )
);