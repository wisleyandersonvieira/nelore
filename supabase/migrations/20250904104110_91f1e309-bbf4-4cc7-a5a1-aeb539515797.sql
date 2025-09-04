-- Criar tabela para funções
CREATE TABLE public.job_functions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code integer NOT NULL,
  name text NOT NULL,
  description text,
  base_salary numeric NOT NULL DEFAULT 0,
  store_id uuid NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Criar tabela para funcionários
CREATE TABLE public.employees (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  cpf text NOT NULL,
  birth_date date,
  gender text CHECK (gender IN ('masculino', 'feminino')),
  marital_status text CHECK (marital_status IN ('casado', 'solteiro', 'divorciado', 'viuvo', 'nao_informado')),
  address text,
  phone text,
  email text,
  job_function_id uuid REFERENCES public.job_functions(id),
  registration_date date NOT NULL DEFAULT CURRENT_DATE,
  base_salary numeric NOT NULL DEFAULT 0,
  bank_account text,
  observations text,
  attachments jsonb DEFAULT '[]'::jsonb,
  store_id uuid NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.job_functions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para job_functions
CREATE POLICY "Users can manage job functions for their store"
ON public.job_functions
FOR ALL
USING ((get_user_role() = 'admin'::user_role) OR (store_id = get_user_store_id()));

CREATE POLICY "Users can view job functions for their store"
ON public.job_functions
FOR SELECT
USING ((get_user_role() = 'admin'::user_role) OR (store_id = get_user_store_id()));

-- Políticas RLS para employees
CREATE POLICY "Users can manage employees for their store"
ON public.employees
FOR ALL
USING ((get_user_role() = 'admin'::user_role) OR (store_id = get_user_store_id()));

CREATE POLICY "Users can view employees for their store"
ON public.employees
FOR SELECT
USING ((get_user_role() = 'admin'::user_role) OR (store_id = get_user_store_id()));

-- Função para gerar próximo código de função
CREATE OR REPLACE FUNCTION public.get_next_job_function_code(store_uuid uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT COALESCE(MAX(code), 0) + 1 
  FROM public.job_functions 
  WHERE store_id = store_uuid;
$function$;

-- Trigger para updated_at em job_functions
CREATE TRIGGER update_job_functions_updated_at
BEFORE UPDATE ON public.job_functions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para updated_at em employees
CREATE TRIGGER update_employees_updated_at
BEFORE UPDATE ON public.employees
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();