CREATE OR REPLACE FUNCTION public.delete_purchase_with_payable(
  p_purchase_id UUID
)
RETURNS TABLE (
  purchase_id UUID,
  purchase_code BIGINT,
  deleted_payables INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_user_role public.user_role;
  v_user_store_id UUID;
  v_purchase RECORD;
  v_deleted_payables INTEGER := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  IF p_purchase_id IS NULL THEN
    RAISE EXCEPTION 'Informe a compra que será excluída.';
  END IF;

  IF NOT public.user_has_permission('contas_pagar', 'write'::public.permission_type) THEN
    RAISE EXCEPTION 'Usuário sem permissão para excluir compras.';
  END IF;

  SELECT p.role, p.store_id
    INTO v_user_role, v_user_store_id
  FROM public.profiles p
  WHERE p.id = v_user_id;

  SELECT pr.id, pr.code, pr.store_id
    INTO v_purchase
  FROM public.purchases pr
  WHERE pr.id = p_purchase_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Compra não encontrada.';
  END IF;

  IF v_user_role IS DISTINCT FROM 'admin'::public.user_role AND NOT (
    v_purchase.store_id = v_user_store_id
    OR EXISTS (
      SELECT 1
      FROM public.user_stores us
      WHERE us.user_id = v_user_id
        AND us.store_id = v_purchase.store_id
    )
  ) THEN
    RAISE EXCEPTION 'Usuário sem acesso à loja desta compra.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.accounts_payable ap
    WHERE ap.purchase_id = p_purchase_id
      AND (
        COALESCE(ap.status, 'pending') <> 'pending'
        OR ap.payment_date IS NOT NULL
      )
  ) THEN
    RAISE EXCEPTION 'Somente compras com contas a pagar pendentes e sem pagamentos podem ser excluídas.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.accounts_payable_installments api
    JOIN public.accounts_payable ap ON ap.id = api.account_payable_id
    WHERE ap.purchase_id = p_purchase_id
      AND (
        api.payment_date IS NOT NULL
        OR COALESCE(api.status, 'pending') <> 'pending'
      )
  ) THEN
    RAISE EXCEPTION 'Somente compras com parcelas pendentes e sem pagamentos podem ser excluídas.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.accounts_payable_payments app
    JOIN public.accounts_payable ap ON ap.id = app.account_payable_id
    WHERE ap.purchase_id = p_purchase_id
  ) THEN
    RAISE EXCEPTION 'A compra possui pagamentos realizados e não pode ser excluída.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.financial_transactions ft
    WHERE (
      ft.reference_type = 'accounts_payable'
      AND ft.reference_id IN (
        SELECT ap.id
        FROM public.accounts_payable ap
        WHERE ap.purchase_id = p_purchase_id
      )
    ) OR (
      ft.reference_type = 'accounts_payable_installments'
      AND ft.reference_id IN (
        SELECT api.id
        FROM public.accounts_payable_installments api
        JOIN public.accounts_payable ap ON ap.id = api.account_payable_id
        WHERE ap.purchase_id = p_purchase_id
      )
    )
  ) THEN
    RAISE EXCEPTION 'A compra possui movimentações financeiras vinculadas e não pode ser excluída.';
  END IF;

  SELECT COUNT(*)
    INTO v_deleted_payables
  FROM public.accounts_payable ap
  WHERE ap.purchase_id = p_purchase_id;

  DELETE FROM public.accounts_payable
  WHERE purchase_id = p_purchase_id;

  DELETE FROM public.purchases
  WHERE id = p_purchase_id;

  RETURN QUERY
  SELECT v_purchase.id, v_purchase.code, v_deleted_payables;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_purchase_with_payable(UUID) TO authenticated;
