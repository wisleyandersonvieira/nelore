-- Performance: índice composto para o padrão de consulta mais comum no módulo de Compras.
--
-- Contexto: a query principal do módulo filtra por store_id (multi-tenant) e por
-- purchase_date (filtro de período), ordenando por purchase_date DESC.
-- O índice simples existente em (store_id) força o planner a fazer um seq scan na data,
-- e o índice em (purchase_date DESC) não ajuda quando há filtro de loja.
-- Este índice composto cobre ambas as condições em uma única varredura de índice.
--
-- Impacto esperado: redução significativa no custo da query principal ao abrir o módulo,
-- especialmente com filtro padrão de 2 meses ativo.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_purchases_store_purchase_date
  ON public.purchases (store_id, purchase_date DESC);

-- Índice para a query de accounts_payable por purchase_id (já existe como unique partial index,
-- mas garantimos que cubra também leituras sem a cláusula WHERE purchase_id IS NOT NULL).
-- O índice existente idx_accounts_payable_purchase_id já é adequado para esse padrão.
-- Nenhuma ação necessária nessa tabela.
