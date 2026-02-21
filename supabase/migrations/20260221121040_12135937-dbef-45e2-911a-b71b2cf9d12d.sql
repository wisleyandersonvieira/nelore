
-- Drop the FK constraint  
ALTER TABLE public.accounts_receivable DROP CONSTRAINT IF EXISTS accounts_receivable_creditor_id_fkey;

-- Update creditor_id to point to supplier records (match by cnpj_cpf)
UPDATE public.accounts_receivable ar
SET creditor_id = (
  SELECT s.id FROM public.suppliers s 
  JOIN public.creditors c ON s.cnpj_cpf = c.cnpj_cpf AND s.is_creditor = true AND s.is_active = true
  WHERE c.id = ar.creditor_id
  LIMIT 1
)
WHERE ar.creditor_id IS NOT NULL
AND EXISTS (
  SELECT 1 FROM public.creditors c 
  JOIN public.suppliers s ON s.cnpj_cpf = c.cnpj_cpf AND s.is_creditor = true AND s.is_active = true
  WHERE c.id = ar.creditor_id
);

-- For any remaining unmatched, match by name
UPDATE public.accounts_receivable ar
SET creditor_id = (
  SELECT s.id FROM public.suppliers s 
  JOIN public.creditors c ON s.name = c.name AND s.matrix_id = c.matrix_id AND s.is_creditor = true AND s.is_active = true
  WHERE c.id = ar.creditor_id
  LIMIT 1
)
WHERE ar.creditor_id IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM public.suppliers WHERE id = ar.creditor_id);

-- Re-add FK constraint pointing to suppliers
ALTER TABLE public.accounts_receivable ADD CONSTRAINT accounts_receivable_creditor_id_fkey 
  FOREIGN KEY (creditor_id) REFERENCES public.suppliers(id);
