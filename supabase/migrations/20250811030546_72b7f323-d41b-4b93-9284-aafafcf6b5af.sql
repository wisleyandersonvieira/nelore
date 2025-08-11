-- Criar contas padrão no plano de contas
INSERT INTO public.chart_of_accounts (id, code, name, account_type, group_id) VALUES 
('11111111-1111-1111-1111-111111111111', '1.1.001', 'Contas a Pagar', 'liability', (SELECT id FROM public.account_groups WHERE account_type = 'liability' LIMIT 1)),
('22222222-2222-2222-2222-222222222222', 'Contas a Receber', '1.1.002', 'asset', (SELECT id FROM public.account_groups WHERE account_type = 'asset' LIMIT 1))
ON CONFLICT (id) DO NOTHING;

-- Se não houver grupos, criar grupos padrão primeiro
INSERT INTO public.account_groups (id, code, name, account_type) VALUES 
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'A001', 'Ativo Circulante', 'asset'),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'P001', 'Passivo Circulante', 'liability')
ON CONFLICT (id) DO NOTHING;

-- Agora inserir as contas corretamente
INSERT INTO public.chart_of_accounts (id, code, name, account_type, group_id) VALUES 
('11111111-1111-1111-1111-111111111111', '1.1.001', 'Contas a Pagar', 'liability', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
('22222222-2222-2222-2222-222222222222', '1.1.002', 'Contas a Receber', 'asset', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
ON CONFLICT (id) DO NOTHING;