
-- Table to allocate accounts payable items to animals, pregnancies, embryo transfers, and aspirations
CREATE TABLE public.accounts_payable_item_allocations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_payable_item_id UUID NOT NULL REFERENCES public.accounts_payable_items(id) ON DELETE CASCADE,
  allocation_type TEXT NOT NULL CHECK (allocation_type IN ('animal', 'pregnancy', 'embryo_transfer', 'aspiration')),
  animal_id UUID REFERENCES public.animals(id) ON DELETE SET NULL,
  pregnancy_id UUID REFERENCES public.pregnancy_management(id) ON DELETE SET NULL,
  embryo_transfer_id UUID REFERENCES public.embryo_transfer_management(id) ON DELETE SET NULL,
  aspiration_id UUID REFERENCES public.aspiration_management(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.accounts_payable_item_allocations ENABLE ROW LEVEL SECURITY;

-- RLS policies - users can manage allocations for items they can access
CREATE POLICY "Users can view allocations in their matrix"
  ON public.accounts_payable_item_allocations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM accounts_payable_items api
      JOIN accounts_payable ap ON api.account_payable_id = ap.id
      WHERE api.id = account_payable_item_id
      AND public.store_in_user_matrix(ap.store_id)
    )
  );

CREATE POLICY "Users can insert allocations"
  ON public.accounts_payable_item_allocations
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM accounts_payable_items api
      JOIN accounts_payable ap ON api.account_payable_id = ap.id
      WHERE api.id = account_payable_item_id
      AND public.store_in_user_matrix(ap.store_id)
    )
  );

CREATE POLICY "Users can update allocations"
  ON public.accounts_payable_item_allocations
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM accounts_payable_items api
      JOIN accounts_payable ap ON api.account_payable_id = ap.id
      WHERE api.id = account_payable_item_id
      AND public.store_in_user_matrix(ap.store_id)
    )
  );

CREATE POLICY "Users can delete allocations"
  ON public.accounts_payable_item_allocations
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM accounts_payable_items api
      JOIN accounts_payable ap ON api.account_payable_id = ap.id
      WHERE api.id = account_payable_item_id
      AND public.store_in_user_matrix(ap.store_id)
    )
  );

-- Index for performance
CREATE INDEX idx_allocations_item_id ON public.accounts_payable_item_allocations(account_payable_item_id);
CREATE INDEX idx_allocations_animal_id ON public.accounts_payable_item_allocations(animal_id);
CREATE INDEX idx_allocations_pregnancy_id ON public.accounts_payable_item_allocations(pregnancy_id);
CREATE INDEX idx_allocations_embryo_transfer_id ON public.accounts_payable_item_allocations(embryo_transfer_id);
CREATE INDEX idx_allocations_aspiration_id ON public.accounts_payable_item_allocations(aspiration_id);
CREATE INDEX idx_allocations_type ON public.accounts_payable_item_allocations(allocation_type);

-- Trigger for updated_at
CREATE TRIGGER update_allocations_updated_at
  BEFORE UPDATE ON public.accounts_payable_item_allocations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
