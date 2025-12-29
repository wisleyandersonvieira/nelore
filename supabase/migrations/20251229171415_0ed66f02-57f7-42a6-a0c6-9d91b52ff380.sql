-- Add DELETE policy for financial_transactions table
CREATE POLICY "Users can delete transactions for their store" 
ON public.financial_transactions 
FOR DELETE 
USING (
  user_has_permission('financeiro'::text, 'write'::permission_type) 
  AND (
    (get_user_role() = 'admin'::user_role) 
    OR (store_id = get_user_store_id())
  )
);