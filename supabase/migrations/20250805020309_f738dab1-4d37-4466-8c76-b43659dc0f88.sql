-- Inserir os grupos padrão se não existirem (com cast correto)
INSERT INTO public.account_groups (name, code, account_type, parent_id)
SELECT * FROM (VALUES
  ('Receitas', '1', 'receita'::account_type, NULL),
  ('Despesas', '2', 'despesa'::account_type, NULL),
  ('Investimentos', '3', 'ativo'::account_type, NULL)
) AS v(name, code, account_type, parent_id)
WHERE NOT EXISTS (
  SELECT 1 FROM public.account_groups 
  WHERE code IN ('1', '2', '3') AND parent_id IS NULL
);