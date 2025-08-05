-- Inserir os grupos padrão se não existirem
INSERT INTO public.account_groups (name, code, account_type, parent_id)
SELECT * FROM (VALUES
  ('Receitas', '1', 'receita', NULL),
  ('Despesas', '2', 'despesa', NULL),
  ('Investimentos', '3', 'ativo', NULL)
) AS v(name, code, account_type, parent_id)
WHERE NOT EXISTS (
  SELECT 1 FROM public.account_groups 
  WHERE code IN ('1', '2', '3') AND parent_id IS NULL
);