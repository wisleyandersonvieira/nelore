-- Upload opcional de nota fiscal na compra

ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS invoice_file_path TEXT,
  ADD COLUMN IF NOT EXISTS invoice_file_name TEXT;

INSERT INTO storage.buckets (id, name, public)
SELECT 'purchase-invoices', 'purchase-invoices', false
WHERE NOT EXISTS (
  SELECT 1 FROM storage.buckets WHERE id = 'purchase-invoices'
);

DROP POLICY IF EXISTS "Users can upload to purchase-invoices bucket" ON storage.objects;
DROP POLICY IF EXISTS "Users can view purchase-invoices bucket" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete from purchase-invoices bucket" ON storage.objects;

CREATE POLICY "Users can upload to purchase-invoices bucket"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'purchase-invoices'
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Users can view purchase-invoices bucket"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'purchase-invoices'
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Users can delete from purchase-invoices bucket"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'purchase-invoices'
  AND auth.uid() IS NOT NULL
);
