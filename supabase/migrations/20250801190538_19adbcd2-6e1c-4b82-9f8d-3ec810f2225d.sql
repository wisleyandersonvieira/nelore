-- Add CNPJ and opening_date columns to stores table
ALTER TABLE stores ADD COLUMN cnpj text;
ALTER TABLE stores ADD COLUMN opening_date date;

-- Create unique index for CNPJ (allowing nulls)
CREATE UNIQUE INDEX stores_cnpj_unique_idx ON stores (cnpj) WHERE cnpj IS NOT NULL AND cnpj != '';