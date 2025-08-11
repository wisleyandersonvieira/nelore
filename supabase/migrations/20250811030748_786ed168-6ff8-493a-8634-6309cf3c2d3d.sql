-- Criar grupos padrão primeiro  
INSERT INTO public.account_groups (id, code, name, account_type) VALUES 
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'A001', 'Ativo Circulante', 'ativo'),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'P001', 'Passivo Circulante', 'passivo')
ON CONFLICT (id) DO NOTHING;

-- Criar contas padrão no plano de contas
INSERT INTO public.chart_of_accounts (id, code, name, account_type, group_id) VALUES 
('11111111-1111-1111-1111-111111111111', '1.1.001', 'Contas a Pagar', 'passivo', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
('22222222-2222-2222-2222-222222222222', '1.1.002', 'Contas a Receber', 'ativo', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
ON CONFLICT (id) DO NOTHING;