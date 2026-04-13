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
  v_payable_ids UUID[];
  v_installment_ids UUID[];
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

  SELECT ARRAY_AGG(ap.id ORDER BY ap.id)
    INTO v_payable_ids
  FROM public.accounts_payable ap
  WHERE ap.purchase_id = p_purchase_id;

  SELECT ARRAY_AGG(api.id ORDER BY api.id)
    INTO v_installment_ids
  FROM public.accounts_payable_installments api
  JOIN public.accounts_payable ap ON ap.id = api.account_payable_id
  WHERE ap.purchase_id = p_purchase_id;

  IF EXISTS (
    SELECT 1
    FROM public.accounts_payable ap
    WHERE ap.purchase_id = p_purchase_id
      AND (
        ap.payment_date IS NOT NULL
        OR COALESCE(ap.status, 'pending') = 'pagamento_suspenso'
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
        OR COALESCE(api.status, 'pending') = 'pagamento_suspenso'
      )
  ) THEN
    RAISE EXCEPTION 'Somente compras com parcelas pendentes e sem pagamentos podem ser excluídas.';
  END IF;

  SELECT COUNT(*)
    INTO v_deleted_payables
  FROM public.accounts_payable ap
  WHERE ap.purchase_id = p_purchase_id;

  IF COALESCE(array_length(v_payable_ids, 1), 0) > 0 THEN
    DELETE FROM public.accounts_payable_payments
    WHERE account_payable_id = ANY(v_payable_ids);

    DELETE FROM public.financial_transactions
    WHERE (
      reference_type = 'accounts_payable'
      AND reference_id = ANY(v_payable_ids)
    )
    OR (
      reference_type = 'accounts_payable_installments'
      AND COALESCE(array_length(v_installment_ids, 1), 0) > 0
      AND reference_id = ANY(v_installment_ids)
    );

    DELETE FROM public.accounts_payable
    WHERE id = ANY(v_payable_ids);
  END IF;

  DELETE FROM public.purchases
  WHERE id = p_purchase_id;

  RETURN QUERY
  SELECT v_purchase.id, v_purchase.code, v_deleted_payables;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_purchase_with_payable(UUID) TO authenticated;
