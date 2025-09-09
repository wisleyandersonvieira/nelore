-- Update the check constraint to allow new stock item types
ALTER TABLE dre_structure_items 
DROP CONSTRAINT IF EXISTS dre_structure_items_item_type_check;

ALTER TABLE dre_structure_items 
ADD CONSTRAINT dre_structure_items_item_type_check 
CHECK (item_type IN ('account_group', 'sum', 'ESTOQUE_INICIAL', 'ESTOQUE_FINAL'));