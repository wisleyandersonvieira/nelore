ALTER TABLE public.products DROP CONSTRAINT products_code_key;
ALTER TABLE public.products ADD CONSTRAINT products_code_matrix_key UNIQUE (code, matrix_id);