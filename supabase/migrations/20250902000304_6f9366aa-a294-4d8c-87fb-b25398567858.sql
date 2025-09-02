-- Make account_id nullable in accounts_receivable table to match accounts_payable structure
ALTER TABLE accounts_receivable ALTER COLUMN account_id DROP NOT NULL;