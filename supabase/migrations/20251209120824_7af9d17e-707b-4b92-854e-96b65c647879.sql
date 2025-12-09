
-- Update user_has_permission to also check profile_permissions
CREATE OR REPLACE FUNCTION public.user_has_permission(module_name text, required_permission permission_type)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $$
BEGIN
  -- Admin role has all permissions
  IF public.get_user_role() = 'admin' THEN
    RETURN TRUE;
  END IF;
  
  -- Check user-specific permissions
  IF EXISTS (
    SELECT 1 FROM public.user_permissions up
    WHERE up.user_id = auth.uid()
    AND up.module = module_name
    AND (
      up.permission = required_permission 
      OR up.permission = 'admin'
      OR (required_permission = 'read' AND up.permission = 'write')
    )
    AND (up.store_id IS NULL OR up.store_id = public.get_user_store_id())
  ) THEN
    RETURN TRUE;
  END IF;
  
  -- Check profile-based permissions
  RETURN EXISTS (
    SELECT 1 
    FROM public.profiles p
    JOIN public.profile_permissions pp ON pp.profile_id = p.profile_id
    WHERE p.id = auth.uid()
    AND pp.module = module_name
    AND (
      pp.permission = required_permission 
      OR pp.permission = 'admin'
      OR (required_permission = 'read' AND pp.permission = 'write')
    )
  );
END;
$$;
