-- Add product_type and function_type columns to products table
ALTER TABLE public.products 
ADD COLUMN product_type text DEFAULT 'product' CHECK (product_type IN ('product', 'service')),
ADD COLUMN function_type text DEFAULT 'debit' CHECK (function_type IN ('credit', 'debit'));