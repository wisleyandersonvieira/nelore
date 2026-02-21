
-- Add role flag columns to suppliers table
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS is_supplier BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS is_creditor BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS is_owner BOOLEAN NOT NULL DEFAULT false;

-- Migrate existing creditors into suppliers table
INSERT INTO public.suppliers (name, cnpj_cpf, address, city, state, phone, email, contact_person, matrix_id, is_active, is_supplier, is_creditor, is_owner)
SELECT 
  c.name, c.cnpj_cpf, c.address, c.city, c.state, c.phone, c.email, c.contact_person, c.matrix_id, c.is_active,
  false, true, false
FROM public.creditors c
WHERE c.is_active = true
AND NOT EXISTS (
  SELECT 1 FROM public.suppliers s 
  WHERE s.cnpj_cpf IS NOT NULL AND s.cnpj_cpf != '' 
  AND s.cnpj_cpf = c.cnpj_cpf AND s.is_active = true
);

-- For creditors that have matching cnpj_cpf in suppliers, update the is_creditor flag
UPDATE public.suppliers s
SET is_creditor = true
FROM public.creditors c
WHERE s.cnpj_cpf IS NOT NULL AND s.cnpj_cpf != ''
AND s.cnpj_cpf = c.cnpj_cpf
AND c.is_active = true AND s.is_active = true;
