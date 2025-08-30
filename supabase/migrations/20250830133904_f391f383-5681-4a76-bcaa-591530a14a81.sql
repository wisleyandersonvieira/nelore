-- Limpar dados orfãos das estruturas DRE que foram "excluídas" logicamente
-- Primeiro, excluir os itens das estruturas inativas
DELETE FROM dre_structure_items 
WHERE structure_id IN (
  SELECT id FROM dre_structures WHERE is_active = false
);

-- Depois, excluir as estruturas inativas
DELETE FROM dre_structures WHERE is_active = false;

-- Verificar se existem entradas relacionadas nas tabelas de valores
DELETE FROM dre_entry_values 
WHERE entry_id IN (
  SELECT id FROM dre_entries WHERE structure_id NOT IN (
    SELECT id FROM dre_structures
  )
);

DELETE FROM dre_entries WHERE structure_id NOT IN (
  SELECT id FROM dre_structures
);