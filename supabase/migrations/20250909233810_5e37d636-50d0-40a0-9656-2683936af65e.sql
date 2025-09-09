-- Create transfers table
CREATE TABLE public.transfers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL,
  transfer_date DATE NOT NULL,
  source_account_id UUID NOT NULL,
  destination_account_id UUID NOT NULL,
  source_account_type TEXT NOT NULL CHECK (source_account_type IN ('current', 'cash', 'card', 'delivery')),
  destination_account_type TEXT NOT NULL CHECK (destination_account_type IN ('current', 'cash', 'card', 'delivery')),
  amount NUMERIC NOT NULL CHECK (amount > 0),
  description TEXT,
  created_by UUID NOT NULL DEFAULT auth.uid(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT different_accounts CHECK (source_account_id != destination_account_id OR source_account_type != destination_account_type)
);

-- Enable RLS
ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can create transfers for their store"
ON public.transfers
FOR INSERT
WITH CHECK (
  user_has_permission('financeiro', 'write') AND
  ((get_user_role() = 'admin') OR (store_id = get_user_store_id())) AND
  (created_by = auth.uid())
);

CREATE POLICY "Users can view transfers for their store"
ON public.transfers
FOR SELECT
USING (
  user_has_permission('financeiro', 'read') AND
  ((get_user_role() = 'admin') OR (store_id = get_user_store_id()))
);

CREATE POLICY "Users can update transfers for their store"
ON public.transfers
FOR UPDATE
USING (
  user_has_permission('financeiro', 'write') AND
  ((get_user_role() = 'admin') OR (store_id = get_user_store_id()))
);

CREATE POLICY "Users can delete transfers for their store"
ON public.transfers
FOR DELETE
USING (
  user_has_permission('financeiro', 'write') AND
  ((get_user_role() = 'admin') OR (store_id = get_user_store_id()))
);

-- Create trigger for updated_at
CREATE TRIGGER update_transfers_updated_at
BEFORE UPDATE ON public.transfers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();