
-- Add owner_type and store_owner_id to animal_owners
ALTER TABLE public.animal_owners 
  ADD COLUMN owner_type text NOT NULL DEFAULT 'supplier',
  ADD COLUMN store_owner_id uuid REFERENCES public.stores(id) ON DELETE CASCADE,
  ALTER COLUMN owner_id DROP NOT NULL;

-- Add owner_type and store_owner_id to pregnancy_owners
ALTER TABLE public.pregnancy_owners 
  ADD COLUMN owner_type text NOT NULL DEFAULT 'supplier',
  ADD COLUMN store_owner_id uuid REFERENCES public.stores(id) ON DELETE CASCADE,
  ALTER COLUMN owner_id DROP NOT NULL;

-- Add owner_type and store_owner_id to aspiration_owners
ALTER TABLE public.aspiration_owners 
  ADD COLUMN owner_type text NOT NULL DEFAULT 'supplier',
  ADD COLUMN store_owner_id uuid REFERENCES public.stores(id) ON DELETE CASCADE,
  ALTER COLUMN owner_id DROP NOT NULL;

-- Add owner_type and store_owner_id to embryo_transfer_owners
ALTER TABLE public.embryo_transfer_owners 
  ADD COLUMN owner_type text NOT NULL DEFAULT 'supplier',
  ADD COLUMN store_owner_id uuid REFERENCES public.stores(id) ON DELETE CASCADE,
  ALTER COLUMN owner_id DROP NOT NULL;
