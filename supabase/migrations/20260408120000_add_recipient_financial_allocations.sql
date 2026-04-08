ALTER TABLE public.accounts_payable_item_allocations
  ADD COLUMN IF NOT EXISTS recipient_id UUID REFERENCES public.animals(id) ON DELETE SET NULL;

ALTER TABLE public.accounts_payable_item_allocations
  DROP CONSTRAINT IF EXISTS accounts_payable_item_allocations_allocation_type_check;

ALTER TABLE public.accounts_payable_item_allocations
  ADD CONSTRAINT accounts_payable_item_allocations_allocation_type_check
  CHECK (allocation_type IN ('animal', 'pregnancy', 'embryo_transfer', 'aspiration', 'recipient'));

CREATE INDEX IF NOT EXISTS idx_allocations_recipient_id
  ON public.accounts_payable_item_allocations(recipient_id);

ALTER TABLE public.accounts_receivable_item_allocations
  ADD COLUMN IF NOT EXISTS recipient_id UUID REFERENCES public.animals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_accounts_receivable_item_allocations_recipient_id
  ON public.accounts_receivable_item_allocations(recipient_id);
