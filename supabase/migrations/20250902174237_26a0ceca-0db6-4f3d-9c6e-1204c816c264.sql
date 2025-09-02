-- Add missing foreign key constraints for delivery_account_stores table
ALTER TABLE public.delivery_account_stores 
ADD CONSTRAINT delivery_account_stores_account_id_fkey 
FOREIGN KEY (account_id) REFERENCES public.delivery_accounts(id) ON DELETE CASCADE;

ALTER TABLE public.delivery_account_stores 
ADD CONSTRAINT delivery_account_stores_store_id_fkey 
FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE;