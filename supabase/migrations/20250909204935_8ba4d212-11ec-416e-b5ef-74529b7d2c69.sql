-- Fix the check constraint to use correct item types from code
ALTER TABLE dre_structure_items 
DROP CONSTRAINT IF EXISTS dre_structure_items_item_type_check;

ALTER TABLE dre_structure_items 
ADD CONSTRAINT dre_structure_items_item_type_check 
CHECK (item_type IN ('subgroup', 'sum_line', 'group', 'account_group', 'sum', 'initial_stock', 'final_stock'));