-- Atualizar o usuário atual para admin
UPDATE public.profiles 
SET role = 'admin'::user_role 
WHERE id = 'c1f4049b-db87-40a6-a699-a0e688318ea8';