
-- 1. Update the handle_new_user trigger to include matrix_id from metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, is_active, matrix_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'name', NEW.email),
    NEW.email,
    false,
    CASE 
      WHEN NEW.raw_user_meta_data ->> 'matrix_id' IS NOT NULL 
        AND NEW.raw_user_meta_data ->> 'matrix_id' != ''
      THEN (NEW.raw_user_meta_data ->> 'matrix_id')::uuid
      ELSE NULL
    END
  );
  RETURN NEW;
END;
$$;

-- 2. Update Matriz user UPDATE policy to also cover profiles with null matrix_id
-- (so they can set the matrix_id on newly created profiles)
DROP POLICY IF EXISTS "Matriz users can update profiles in their matrix" ON public.profiles;
CREATE POLICY "Matriz users can update profiles in their matrix"
ON public.profiles FOR UPDATE
TO authenticated
USING (
  is_matriz_profile_user() AND (matrix_id = get_current_user_matrix_id() OR matrix_id IS NULL)
)
WITH CHECK (
  is_matriz_profile_user() AND (matrix_id = get_current_user_matrix_id())
);

-- 3. Update Matriz user SELECT policy to also show profiles with null matrix_id
-- that were just created (so the update can find them)
DROP POLICY IF EXISTS "Matriz users can view profiles in their matrix" ON public.profiles;
CREATE POLICY "Matriz users can view profiles in their matrix"
ON public.profiles FOR SELECT
TO authenticated
USING (
  is_matriz_profile_user() AND (matrix_id = get_current_user_matrix_id() OR matrix_id IS NULL)
);
