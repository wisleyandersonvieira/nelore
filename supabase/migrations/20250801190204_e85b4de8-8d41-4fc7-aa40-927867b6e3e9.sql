-- Add unique constraint for CNPJ/CPF in suppliers table
ALTER TABLE suppliers ADD CONSTRAINT suppliers_cnpj_cpf_unique UNIQUE (cnpj_cpf);

-- Update suppliers table to handle null values properly for the constraint
CREATE UNIQUE INDEX suppliers_cnpj_cpf_unique_idx ON suppliers (cnpj_cpf) WHERE cnpj_cpf IS NOT NULL AND cnpj_cpf != '';