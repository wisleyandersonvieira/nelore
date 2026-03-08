-- Fix animals RLS policies to use user_has_access_to_store
DROP POLICY IF EXISTS "Users can view animals for their store" ON public.animals;
CREATE POLICY "Users can view animals for their store" ON public.animals
  FOR SELECT TO authenticated
  USING (user_has_access_to_store(store_id));

DROP POLICY IF EXISTS "Users can update animals for their store" ON public.animals;
CREATE POLICY "Users can update animals for their store" ON public.animals
  FOR UPDATE TO authenticated
  USING (user_has_access_to_store(store_id));

DROP POLICY IF EXISTS "Users can delete animals for their store" ON public.animals;
CREATE POLICY "Users can delete animals for their store" ON public.animals
  FOR DELETE TO authenticated
  USING (user_has_access_to_store(store_id));

-- Fix pregnancy_management RLS policies
DROP POLICY IF EXISTS "Users can view pregnancy management for their store" ON public.pregnancy_management;
CREATE POLICY "Users can view pregnancy management for their store" ON public.pregnancy_management
  FOR SELECT TO authenticated
  USING (user_has_access_to_store(store_id));

DROP POLICY IF EXISTS "Users can update pregnancy management for their store" ON public.pregnancy_management;
CREATE POLICY "Users can update pregnancy management for their store" ON public.pregnancy_management
  FOR UPDATE TO authenticated
  USING (user_has_access_to_store(store_id));

DROP POLICY IF EXISTS "Users can delete pregnancy management for their store" ON public.pregnancy_management;
CREATE POLICY "Users can delete pregnancy management for their store" ON public.pregnancy_management
  FOR DELETE TO authenticated
  USING (user_has_access_to_store(store_id));

-- Fix embryo_transfer_management RLS policies
DROP POLICY IF EXISTS "Users can view embryo transfer records" ON public.embryo_transfer_management;
CREATE POLICY "Users can view embryo transfer records" ON public.embryo_transfer_management
  FOR SELECT TO authenticated
  USING (user_has_access_to_store(store_id));

DROP POLICY IF EXISTS "Users can update embryo transfer records" ON public.embryo_transfer_management;
CREATE POLICY "Users can update embryo transfer records" ON public.embryo_transfer_management
  FOR UPDATE TO authenticated
  USING (user_has_access_to_store(store_id));

DROP POLICY IF EXISTS "Users can delete embryo transfer records" ON public.embryo_transfer_management;
CREATE POLICY "Users can delete embryo transfer records" ON public.embryo_transfer_management
  FOR DELETE TO authenticated
  USING (user_has_access_to_store(store_id));

-- Fix aspiration_management RLS policies
DROP POLICY IF EXISTS "Users can view aspiration records from their store" ON public.aspiration_management;
CREATE POLICY "Users can view aspiration records from their store" ON public.aspiration_management
  FOR SELECT TO authenticated
  USING (user_has_access_to_store(store_id));

DROP POLICY IF EXISTS "Users can update aspiration records" ON public.aspiration_management;
CREATE POLICY "Users can update aspiration records" ON public.aspiration_management
  FOR UPDATE TO authenticated
  USING (user_has_access_to_store(store_id));

DROP POLICY IF EXISTS "Users can delete aspiration records" ON public.aspiration_management;
CREATE POLICY "Users can delete aspiration records" ON public.aspiration_management
  FOR DELETE TO authenticated
  USING (user_has_access_to_store(store_id));