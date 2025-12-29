-- Clean up duplicate financial_transactions by keeping only the most recent one for each reference_id
DELETE FROM financial_transactions 
WHERE id IN (
  SELECT id FROM (
    SELECT id, 
           ROW_NUMBER() OVER (PARTITION BY reference_id, reference_type ORDER BY created_at DESC) as rn
    FROM financial_transactions
  ) t 
  WHERE rn > 1
);