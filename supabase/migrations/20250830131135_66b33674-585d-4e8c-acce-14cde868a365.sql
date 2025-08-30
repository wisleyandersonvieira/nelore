-- Add store association to suppliers and creditors tables
ALTER TABLE public.suppliers ADD COLUMN store_id UUID;
ALTER TABLE public.creditors ADD COLUMN store_id UUID;

-- Add foreign key constraints (optional, but recommended for data integrity)
ALTER TABLE public.suppliers ADD CONSTRAINT fk_suppliers_store 
  FOREIGN KEY (store_id) REFERENCES public.stores(id);
ALTER TABLE public.creditors ADD CONSTRAINT fk_creditors_store 
  FOREIGN KEY (store_id) REFERENCES public.stores(id);

-- Update existing suppliers to associate with first available store (for migration)
-- This ensures existing data doesn't become inaccessible
UPDATE public.suppliers SET store_id = (
  SELECT id FROM public.stores LIMIT 1
) WHERE store_id IS NULL;

UPDATE public.creditors SET store_id = (
  SELECT id FROM public.stores LIMIT 1
) WHERE store_id IS NULL;

-- Make store_id required going forward
ALTER TABLE public.suppliers ALTER COLUMN store_id SET NOT NULL;
ALTER TABLE public.creditors ALTER COLUMN store_id SET NOT NULL;

-- Drop old permissive policies
DROP POLICY IF EXISTS "Users can manage suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Users can view suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Users can manage creditors" ON public.creditors;
DROP POLICY IF EXISTS "Users can view creditors" ON public.creditors;

-- Create new store-based RLS policies for suppliers
CREATE POLICY "Users can view suppliers for their store" 
ON public.suppliers 
FOR SELECT 
USING (
  auth.role() = 'authenticated' AND (
    get_user_role() = 'admin' OR 
    store_id = get_user_store_id()
  )
);

CREATE POLICY "Users can create suppliers for their store" 
ON public.suppliers 
FOR INSERT 
WITH CHECK (
  auth.role() = 'authenticated' AND (
    get_user_role() = 'admin' OR 
    store_id = get_user_store_id()
  )
);

CREATE POLICY "Users can update suppliers for their store" 
ON public.suppliers 
FOR UPDATE 
USING (
  auth.role() = 'authenticated' AND (
    get_user_role() = 'admin' OR 
    store_id = get_user_store_id()
  )
);

CREATE POLICY "Users can delete suppliers for their store" 
ON public.suppliers 
FOR DELETE 
USING (
  auth.role() = 'authenticated' AND (
    get_user_role() = 'admin' OR 
    store_id = get_user_store_id()
  )
);

-- Create new store-based RLS policies for creditors
CREATE POLICY "Users can view creditors for their store" 
ON public.creditors 
FOR SELECT 
USING (
  auth.role() = 'authenticated' AND (
    get_user_role() = 'admin' OR 
    store_id = get_user_store_id()
  )
);

CREATE POLICY "Users can create creditors for their store" 
ON public.creditors 
FOR INSERT 
WITH CHECK (
  auth.role() = 'authenticated' AND (
    get_user_role() = 'admin' OR 
    store_id = get_user_store_id()
  )
);

CREATE POLICY "Users can update creditors for their store" 
ON public.creditors 
FOR UPDATE 
USING (
  auth.role() = 'authenticated' AND (
    get_user_role() = 'admin' OR 
    store_id = get_user_store_id()
  )
);

CREATE POLICY "Users can delete creditors for their store" 
ON public.creditors 
FOR DELETE 
USING (
  auth.role() = 'authenticated' AND (
    get_user_role() = 'admin' OR 
    store_id = get_user_store_id()
  )
);