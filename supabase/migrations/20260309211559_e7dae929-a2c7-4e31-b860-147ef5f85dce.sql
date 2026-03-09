ALTER TABLE public.suppliers DROP CONSTRAINT IF EXISTS suppliers_cnpj_cpf_unique;
ALTER TABLE public.suppliers ADD CONSTRAINT suppliers_cnpj_cpf_matrix_unique UNIQUE (cnpj_cpf, matrix_id);