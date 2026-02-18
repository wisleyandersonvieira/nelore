
-- Create allocation table for accounts receivable items (mirrors accounts_payable_item_allocations)
CREATE TABLE public.accounts_receivable_item_allocations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_receivable_item_id UUID NOT NULL REFERENCES public.accounts_receivable_items(id) ON DELETE CASCADE,
  allocation_type TEXT NOT NULL,
  animal_id UUID REFERENCES public.animals(id),
  aspiration_id UUID REFERENCES public.aspiration_management(id),
  embryo_transfer_id UUID REFERENCES public.embryo_transfer_management(id),
  pregnancy_id UUID REFERENCES public.pregnancy_management(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.accounts_receivable_item_allocations ENABLE ROW LEVEL SECURITY;

-- RLS policies (same pattern as accounts_payable_item_allocations)
CREATE POLICY "Users can view receivable item allocations"
ON public.accounts_receivable_item_allocations
FOR SELECT
USING (true);

CREATE POLICY "Users can insert receivable item allocations"
ON public.accounts_receivable_item_allocations
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can update receivable item allocations"
ON public.accounts_receivable_item_allocations
FOR UPDATE
USING (true);

CREATE POLICY "Users can delete receivable item allocations"
ON public.accounts_receivable_item_allocations
FOR DELETE
USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_accounts_receivable_item_allocations_updated_at
BEFORE UPDATE ON public.accounts_receivable_item_allocations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
