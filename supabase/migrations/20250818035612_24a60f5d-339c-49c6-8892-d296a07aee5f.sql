-- Create storage bucket for account documents
INSERT INTO storage.buckets (id, name, public) 
VALUES ('account-documents', 'account-documents', false);

-- Create policies for document access
CREATE POLICY "Users can view their own account documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'account-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload their own account documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'account-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own account documents"
ON storage.objects FOR UPDATE
USING (bucket_id = 'account-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own account documents"
ON storage.objects FOR DELETE
USING (bucket_id = 'account-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Add attachments column to accounts_payable table
ALTER TABLE accounts_payable 
ADD COLUMN attachments JSONB DEFAULT '[]'::jsonb;