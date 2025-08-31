-- Add payment_date to installments table to track when each installment was paid
ALTER TABLE accounts_payable_installments 
ADD COLUMN payment_date date;