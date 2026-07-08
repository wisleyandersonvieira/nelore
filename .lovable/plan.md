## Ajustes em FINANCEIRO > COMPRAS (tipo Sêmen)

### 1. Destaque verde/vermelho na listagem de sêmen
No seletor de item do modal de compra (quando `purchaseType = "semen"`), cada registro de sêmen será colorido:
- **Verde**: já existe uma compra vinculada a esse sêmen
- **Vermelho**: nenhuma compra vinculada ainda

A verificação será feita cruzando a lista de sêmen com os IDs presentes em `purchases.semen_id` e nos novos itens de compra multi-sêmen (ver item 2).

### 2. Vincular múltiplos sêmens em uma mesma compra
Hoje a compra permite apenas UM item vinculado (`semen_id` direto na tabela `purchases`). Vamos permitir N sêmens por compra, cada um com seu valor.

#### Mudanças no banco
- Criar tabela `purchase_semen_items`:
  - `purchase_id` (FK), `semen_id` (FK), `amount` (numeric), `created_at`
  - GRANTs + RLS por `matrix_id` (via `purchase_id`)
- Migrar linhas atuais de `purchases` com `semen_id != null` para a nova tabela (usando `total_amount` como valor).
- Atualizar as RPCs `create_purchase_with_payable`, `update_purchase_with_payable` e `delete_purchase_with_payable` para aceitar/gravar/excluir múltiplos itens de sêmen. Para outros tipos (animal, prenhez, etc.) o comportamento continua igual (um item só).
- O `total_amount` da compra passa a ser a soma dos valores dos itens quando for sêmen.

#### Mudanças no modal `PurchasesCreateModal`
- Quando `purchaseType = "semen"`:
  - No lugar do seletor único, mostrar uma lista de linhas (sêmen selecionado + valor + botão remover) e um botão **(+) Adicionar sêmen** que abre o popover de busca para adicionar mais.
  - Campo "Valor total" fica read-only (soma dos itens); as parcelas usam essa soma.
  - Os itens já usados nessa compra (em modo edição) vêm pré-carregados.
- Demais tipos ficam idênticos ao fluxo atual.

#### Mudanças na listagem do módulo (`PurchasesModule`)
- Ao exibir compras do tipo sêmen, mostrar todos os sêmens vinculados (nomes/códigos) e o valor por item na linha expandida/tooltip.
- O agrupamento por `semenId` passa a considerar múltiplos IDs.

### Detalhes técnicos
- Arquivos afetados: `src/components/PurchasesCreateModal.tsx`, `src/pages/PurchasesModule.tsx`, `src/lib/purchases.ts`, novas migrations Supabase (tabela + RPC updates).
- Compatibilidade: manter `purchases.semen_id` (deprecado) preenchido com o primeiro item para não quebrar telas legadas (Comissões etc.), ou remover após validação — a definir na implementação.
- Sem alterações no fluxo de contas a pagar/parcelas.

Pode aprovar para eu implementar?
