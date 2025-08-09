-- Create user profiles/roles table
CREATE TABLE public.user_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Create policies for user_profiles
CREATE POLICY "Admins can manage user profiles" 
ON public.user_profiles 
FOR ALL 
USING (get_user_role() = 'admin');

CREATE POLICY "Users can view user profiles" 
ON public.user_profiles 
FOR SELECT 
USING (auth.role() = 'authenticated');

-- Create profile permissions table
CREATE TABLE public.profile_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  module TEXT NOT NULL,
  permission permission_type NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profile_permissions ENABLE ROW LEVEL SECURITY;

-- Create policies for profile_permissions
CREATE POLICY "Admins can manage profile permissions" 
ON public.profile_permissions 
FOR ALL 
USING (get_user_role() = 'admin');

CREATE POLICY "Users can view profile permissions" 
ON public.profile_permissions 
FOR SELECT 
USING (auth.role() = 'authenticated');

-- Add profile_id to profiles table
ALTER TABLE public.profiles ADD COLUMN profile_id UUID REFERENCES public.user_profiles(id);

-- Create trigger for updated_at
CREATE TRIGGER update_user_profiles_updated_at
BEFORE UPDATE ON public.user_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default profiles
INSERT INTO public.user_profiles (name, description) VALUES 
('Administrador', 'Acesso total ao sistema'),
('Gerente de Loja', 'Acesso completo à loja designada'),
('Operador', 'Acesso básico para operações diárias'),
('Visualizador', 'Apenas visualização de dados');

-- Insert default permissions for Administrator
INSERT INTO public.profile_permissions (profile_id, module, permission) 
SELECT 
  (SELECT id FROM public.user_profiles WHERE name = 'Administrador'),
  module,
  'admin'::permission_type
FROM (VALUES 
  ('produtos'),
  ('fornecedores'), 
  ('usuarios'),
  ('lojas'),
  ('financeiro'),
  ('caixa'),
  ('contas_pagar'),
  ('contas_receber'),
  ('relatorios')
) AS modules(module);