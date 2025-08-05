-- Inserir os grupos padrão se não existirem (com tipos corretos)
DO $$
BEGIN
  -- Inserir Receitas se não existir
  IF NOT EXISTS (SELECT 1 FROM public.account_groups WHERE code = '1' AND parent_id IS NULL) THEN
    INSERT INTO public.account_groups (name, code, account_type, parent_id)
    VALUES ('Receitas', '1', 'receita'::account_type, NULL);
  END IF;

  -- Inserir Despesas se não existir
  IF NOT EXISTS (SELECT 1 FROM public.account_groups WHERE code = '2' AND parent_id IS NULL) THEN
    INSERT INTO public.account_groups (name, code, account_type, parent_id)
    VALUES ('Despesas', '2', 'despesa'::account_type, NULL);
  END IF;

  -- Inserir Investimentos se não existir
  IF NOT EXISTS (SELECT 1 FROM public.account_groups WHERE code = '3' AND parent_id IS NULL) THEN
    INSERT INTO public.account_groups (name, code, account_type, parent_id)
    VALUES ('Investimentos', '3', 'ativo'::account_type, NULL);
  END IF;
END $$;