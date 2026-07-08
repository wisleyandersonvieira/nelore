CREATE OR REPLACE FUNCTION public.create_purchase_with_payable(p_supplier_id uuid, p_purchase_type text, p_item_id uuid, p_product_id uuid, p_purchase_date date, p_issue_date date, p_competence_date date, p_first_due_date date, p_total_amount numeric, p_document_type text DEFAULT NULL::text, p_document_number text DEFAULT NULL::text, p_description text DEFAULT NULL::text, p_notes text DEFAULT NULL::text, p_negotiation_method text DEFAULT NULL::text, p_installments jsonb DEFAULT '[]'::jsonb, p_semen_items jsonb DEFAULT NULL::jsonb)
 RETURNS TABLE(purchase_id uuid, purchase_code bigint, account_payable_id uuid)
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_store_id UUID;
  v_item_name TEXT;
  v_item_code TEXT;
  v_purchase_description TEXT;
  v_payable_description TEXT;
  v_purchase_id UUID;
  v_purchase_code BIGINT;
  v_payable_id UUID;
  v_payable_item_id UUID;
  v_installment JSONB;
  v_installment_number INTEGER;
  v_installment_due_date DATE;
  v_installment_amount NUMERIC(12, 2);
  v_installment_total NUMERIC(12, 2) := 0;
  v_installment_count INTEGER := 0;
  v_semen_item JSONB;
  v_semen_id UUID;
  v_semen_amount NUMERIC(12,2);
  v_semen_total NUMERIC(12,2) := 0;
  v_primary_semen_id UUID;
  v_semen_item_count INTEGER := 0;
  v_is_multi_semen BOOLEAN := FALSE;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado.'; END IF;
  IF p_supplier_id IS NULL THEN RAISE EXCEPTION 'Fornecedor é obrigatório.'; END IF;
  IF p_product_id IS NULL THEN RAISE EXCEPTION 'Produto financeiro é obrigatório.'; END IF;
  IF p_purchase_type NOT IN ('animal', 'pregnancy', 'aspiration', 'recipient', 'semen') THEN
    RAISE EXCEPTION 'Tipo de compra inválido: %.', p_purchase_type;
  END IF;

  IF p_purchase_type = 'semen' AND p_semen_items IS NOT NULL AND jsonb_typeof(p_semen_items) = 'array' AND jsonb_array_length(p_semen_items) > 0 THEN
    v_is_multi_semen := TRUE;
    v_primary_semen_id := ((p_semen_items -> 0) ->> 'semen_id')::UUID;
    IF v_primary_semen_id IS NULL THEN RAISE EXCEPTION 'Item de sêmen inválido.'; END IF;
    p_item_id := v_primary_semen_id;
  END IF;

  IF p_item_id IS NULL THEN RAISE EXCEPTION 'Item comprado é obrigatório.'; END IF;

  IF p_purchase_date IS NULL OR p_issue_date IS NULL OR p_competence_date IS NULL OR p_first_due_date IS NULL THEN
    RAISE EXCEPTION 'Datas da compra, emissão, competência e primeiro vencimento são obrigatórias.';
  END IF;
  IF p_total_amount IS NULL OR p_total_amount <= 0 THEN
    RAISE EXCEPTION 'Valor total da compra deve ser maior que zero.';
  END IF;

  CASE p_purchase_type
    WHEN 'animal' THEN SELECT store_id, name, code::TEXT INTO v_store_id, v_item_name, v_item_code FROM public.animals WHERE id = p_item_id;
    WHEN 'pregnancy' THEN SELECT store_id, name, code::TEXT INTO v_store_id, v_item_name, v_item_code FROM public.pregnancy_management WHERE id = p_item_id;
    WHEN 'aspiration' THEN SELECT store_id, name, code::TEXT INTO v_store_id, v_item_name, v_item_code FROM public.aspiration_management WHERE id = p_item_id;
    WHEN 'recipient' THEN SELECT store_id, name, code::TEXT INTO v_store_id, v_item_name, v_item_code FROM public.animals WHERE id = p_item_id;
    WHEN 'semen' THEN SELECT store_id, name, code::TEXT INTO v_store_id, v_item_name, v_item_code FROM public.semen WHERE id = p_item_id;
  END CASE;

  IF v_store_id IS NULL THEN RAISE EXCEPTION 'Registro de origem não encontrado para o tipo selecionado.'; END IF;

  IF p_document_type IS NOT NULL AND p_document_number IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.accounts_payable ap
      WHERE ap.supplier_id = p_supplier_id AND ap.document_type = p_document_type
        AND ap.document_number = p_document_number AND COALESCE(ap.purchase_link_origin, 'manual') = 'manual'
    ) THEN
      RAISE EXCEPTION 'Já existe um título manual com o mesmo tipo e número de documento para este fornecedor.';
    END IF;
  END IF;

  IF p_installments IS NULL OR jsonb_typeof(p_installments) <> 'array' OR jsonb_array_length(p_installments) = 0 THEN
    p_installments := jsonb_build_array(jsonb_build_object('installment_number', 1, 'due_date', p_first_due_date, 'amount', ROUND(p_total_amount::numeric, 2)));
  END IF;

  v_purchase_description := COALESCE(
    NULLIF(BTRIM(p_description), ''),
    FORMAT('%s%s%s', INITCAP(p_purchase_type),
      CASE WHEN v_item_code IS NOT NULL AND v_item_code <> '' THEN ' ' || v_item_code ELSE '' END,
      CASE WHEN v_item_name IS NOT NULL AND v_item_name <> '' THEN ' - ' || v_item_name ELSE '' END)
  );

  INSERT INTO public.purchases (
    supplier_id, store_id, product_id, purchase_type,
    animal_id, pregnancy_id, aspiration_id, recipient_id, semen_id,
    item_name, item_code, description, document_type, document_number,
    negotiation_method, purchase_date, issue_date, first_due_date, competence_date,
    total_amount, installment_count, notes, created_by, origin_type
  ) VALUES (
    p_supplier_id, v_store_id, p_product_id, p_purchase_type,
    CASE WHEN p_purchase_type = 'animal' THEN p_item_id ELSE NULL END,
    CASE WHEN p_purchase_type = 'pregnancy' THEN p_item_id ELSE NULL END,
    CASE WHEN p_purchase_type = 'aspiration' THEN p_item_id ELSE NULL END,
    CASE WHEN p_purchase_type = 'recipient' THEN p_item_id ELSE NULL END,
    CASE WHEN p_purchase_type = 'semen' THEN p_item_id ELSE NULL END,
    v_item_name, v_item_code, v_purchase_description, p_document_type, p_document_number,
    p_negotiation_method, p_purchase_date, p_issue_date, p_first_due_date, p_competence_date,
    ROUND(p_total_amount::numeric, 2), GREATEST(jsonb_array_length(p_installments), 1),
    NULLIF(BTRIM(p_notes), ''), v_user_id, 'manual'
  ) RETURNING id, code INTO v_purchase_id, v_purchase_code;

  IF v_is_multi_semen THEN
    FOR v_semen_item IN SELECT value FROM jsonb_array_elements(p_semen_items) LOOP
      v_semen_id := (v_semen_item ->> 'semen_id')::UUID;
      v_semen_amount := ROUND(COALESCE((v_semen_item ->> 'amount')::NUMERIC, 0)::numeric, 2);
      IF v_semen_id IS NULL THEN RAISE EXCEPTION 'Item de sêmen sem identificador.'; END IF;
      IF v_semen_amount <= 0 THEN RAISE EXCEPTION 'Cada item de sêmen precisa ter valor maior que zero.'; END IF;
      INSERT INTO public.purchase_semen_items (purchase_id, semen_id, amount)
      VALUES (v_purchase_id, v_semen_id, v_semen_amount);
      v_semen_total := v_semen_total + v_semen_amount;
      v_semen_item_count := v_semen_item_count + 1;
    END LOOP;
    IF ABS(v_semen_total - ROUND(p_total_amount::numeric, 2)) > 0.01 THEN
      RAISE EXCEPTION 'A soma dos itens de sêmen deve ser igual ao valor total da compra.';
    END IF;
  ELSIF p_purchase_type = 'semen' THEN
    INSERT INTO public.purchase_semen_items (purchase_id, semen_id, amount)
    VALUES (v_purchase_id, p_item_id, ROUND(p_total_amount::numeric, 2));
  END IF;

  v_payable_description := FORMAT('Compra #%s - %s', v_purchase_code, v_purchase_description);

  INSERT INTO public.accounts_payable (
    supplier_id, purchase_id, description, document_type, document_number,
    issue_date, due_date, data_competencia, amount, total_amount, notes, status,
    store_id, account_id, created_by, updated_by,
    purchase_link_origin, purchase_linked_at, purchase_linked_by
  ) VALUES (
    p_supplier_id, v_purchase_id, v_payable_description, p_document_type, p_document_number,
    p_issue_date, p_first_due_date, p_competence_date,
    ROUND(p_total_amount::numeric, 2), ROUND(p_total_amount::numeric, 2),
    NULLIF(BTRIM(p_notes), ''), 'pending',
    v_store_id, NULL, v_user_id, v_user_id,
    'manual', now(), v_user_id
  ) RETURNING id INTO v_payable_id;

  INSERT INTO public.accounts_payable_items (
    account_payable_id, product_id, quantity, unit_price, total_price, store_id
  ) VALUES (
    v_payable_id, p_product_id, 1,
    ROUND(p_total_amount::numeric, 2), ROUND(p_total_amount::numeric, 2), v_store_id
  ) RETURNING id INTO v_payable_item_id;

  IF v_is_multi_semen THEN
    -- Uma alocação por item de sêmen, para exibir vínculo em cada cadastro
    FOR v_semen_item IN SELECT value FROM jsonb_array_elements(p_semen_items) LOOP
      v_semen_id := (v_semen_item ->> 'semen_id')::UUID;
      INSERT INTO public.accounts_payable_item_allocations (
        account_payable_item_id, allocation_type, semen_id
      ) VALUES (v_payable_item_id, 'semen', v_semen_id);
    END LOOP;
  ELSE
    INSERT INTO public.accounts_payable_item_allocations (
      account_payable_item_id, allocation_type,
      animal_id, aspiration_id, pregnancy_id, recipient_id, semen_id
    ) VALUES (
      v_payable_item_id, p_purchase_type,
      CASE WHEN p_purchase_type = 'animal' THEN p_item_id ELSE NULL END,
      CASE WHEN p_purchase_type = 'aspiration' THEN p_item_id ELSE NULL END,
      CASE WHEN p_purchase_type = 'pregnancy' THEN p_item_id ELSE NULL END,
      CASE WHEN p_purchase_type = 'recipient' THEN p_item_id ELSE NULL END,
      CASE WHEN p_purchase_type = 'semen' THEN p_item_id ELSE NULL END
    );
  END IF;

  FOR v_installment IN SELECT value FROM jsonb_array_elements(p_installments) LOOP
    v_installment_count := v_installment_count + 1;
    v_installment_number := COALESCE((v_installment ->> 'installment_number')::INTEGER, v_installment_count);
    v_installment_due_date := (v_installment ->> 'due_date')::DATE;
    v_installment_amount := ROUND(COALESCE((v_installment ->> 'amount')::NUMERIC, 0)::numeric, 2);

    IF v_installment_due_date IS NULL THEN RAISE EXCEPTION 'Todas as parcelas precisam ter data de vencimento.'; END IF;
    IF v_installment_amount <= 0 THEN RAISE EXCEPTION 'Todas as parcelas precisam ter valor maior que zero.'; END IF;
    v_installment_total := v_installment_total + v_installment_amount;

    INSERT INTO public.accounts_payable_installments (account_payable_id, installment_number, due_date, amount, status)
    VALUES (v_payable_id, v_installment_number, v_installment_due_date, v_installment_amount, 'pending');
  END LOOP;

  IF ABS(v_installment_total - ROUND(p_total_amount::numeric, 2)) > 0.01 THEN
    RAISE EXCEPTION 'A soma das parcelas deve ser igual ao valor total da compra.';
  END IF;

  UPDATE public.purchases SET installment_count = v_installment_count WHERE id = v_purchase_id;

  RETURN QUERY SELECT v_purchase_id, v_purchase_code, v_payable_id;
END;
$function$;


CREATE OR REPLACE FUNCTION public.update_purchase_with_payable(p_purchase_id uuid, p_supplier_id uuid, p_purchase_type text, p_item_id uuid, p_product_id uuid, p_purchase_date date, p_issue_date date, p_competence_date date, p_first_due_date date, p_total_amount numeric, p_document_type text DEFAULT NULL::text, p_document_number text DEFAULT NULL::text, p_description text DEFAULT NULL::text, p_notes text DEFAULT NULL::text, p_negotiation_method text DEFAULT NULL::text, p_installments jsonb DEFAULT '[]'::jsonb, p_semen_items jsonb DEFAULT NULL::jsonb)
 RETURNS TABLE(purchase_id uuid, purchase_code bigint, account_payable_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_user_role public.user_role;
  v_user_store_id UUID;
  v_existing_purchase RECORD;
  v_payable_id UUID;
  v_payable_count INTEGER := 0;
  v_store_id UUID;
  v_item_name TEXT;
  v_item_code TEXT;
  v_purchase_description TEXT;
  v_payable_description TEXT;
  v_payable_item_id UUID;
  v_installment JSONB;
  v_installment_count INTEGER := 0;
  v_installment_number INTEGER;
  v_installment_due_date DATE;
  v_installment_amount NUMERIC(12, 2);
  v_installment_total NUMERIC(12, 2) := 0;
  v_semen_item JSONB;
  v_semen_id UUID;
  v_semen_amount NUMERIC(12,2);
  v_semen_total NUMERIC(12,2) := 0;
  v_primary_semen_id UUID;
  v_is_multi_semen BOOLEAN := FALSE;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado.'; END IF;
  IF p_purchase_id IS NULL THEN RAISE EXCEPTION 'Compra inválida para atualização.'; END IF;

  IF NOT public.user_has_permission('contas_pagar', 'write'::public.permission_type) THEN
    RAISE EXCEPTION 'Usuário sem permissão para editar compras.';
  END IF;

  IF p_supplier_id IS NULL THEN RAISE EXCEPTION 'Fornecedor é obrigatório.'; END IF;
  IF p_product_id IS NULL THEN RAISE EXCEPTION 'Produto financeiro é obrigatório.'; END IF;

  IF p_purchase_type NOT IN ('animal', 'pregnancy', 'aspiration', 'recipient', 'semen') THEN
    RAISE EXCEPTION 'Tipo de compra inválido: %.', p_purchase_type;
  END IF;

  IF p_purchase_type = 'semen' AND p_semen_items IS NOT NULL AND jsonb_typeof(p_semen_items) = 'array' AND jsonb_array_length(p_semen_items) > 0 THEN
    v_is_multi_semen := TRUE;
    v_primary_semen_id := ((p_semen_items -> 0) ->> 'semen_id')::UUID;
    IF v_primary_semen_id IS NULL THEN RAISE EXCEPTION 'Item de sêmen inválido.'; END IF;
    p_item_id := v_primary_semen_id;
  END IF;

  IF p_item_id IS NULL THEN RAISE EXCEPTION 'Item comprado é obrigatório.'; END IF;

  IF p_purchase_date IS NULL OR p_issue_date IS NULL OR p_competence_date IS NULL OR p_first_due_date IS NULL THEN
    RAISE EXCEPTION 'Datas da compra, emissão, competência e primeiro vencimento são obrigatórias.';
  END IF;
  IF p_total_amount IS NULL OR p_total_amount <= 0 THEN
    RAISE EXCEPTION 'Valor total da compra deve ser maior que zero.';
  END IF;

  SELECT p.role, p.store_id INTO v_user_role, v_user_store_id
  FROM public.profiles p WHERE p.id = v_user_id;

  SELECT pr.id, pr.code, pr.store_id, pr.origin_type INTO v_existing_purchase
  FROM public.purchases pr WHERE pr.id = p_purchase_id FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Compra não encontrada.'; END IF;
  IF v_existing_purchase.origin_type IS DISTINCT FROM 'manual' THEN
    RAISE EXCEPTION 'Somente compras manuais podem ser editadas.';
  END IF;

  IF v_user_role IS DISTINCT FROM 'admin'::public.user_role AND NOT (
    v_existing_purchase.store_id = v_user_store_id
    OR EXISTS (SELECT 1 FROM public.user_stores us WHERE us.user_id = v_user_id AND us.store_id = v_existing_purchase.store_id)
  ) THEN
    RAISE EXCEPTION 'Usuário sem acesso à loja desta compra.';
  END IF;

  SELECT COUNT(*) INTO v_payable_count FROM public.accounts_payable ap
  WHERE ap.purchase_id = p_purchase_id AND COALESCE(ap.purchase_link_origin, 'manual') = 'manual';

  IF v_payable_count <> 1 THEN
    RAISE EXCEPTION 'A compra precisa ter exatamente um título manual vinculado para permitir edição.';
  END IF;

  SELECT ap.id INTO v_payable_id FROM public.accounts_payable ap
  WHERE ap.purchase_id = p_purchase_id AND COALESCE(ap.purchase_link_origin, 'manual') = 'manual'
  ORDER BY ap.id LIMIT 1 FOR UPDATE;

  IF v_payable_id IS NULL THEN RAISE EXCEPTION 'Título financeiro vinculado à compra não encontrado.'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.accounts_payable ap
    WHERE ap.id = v_payable_id
      AND (ap.payment_date IS NOT NULL OR COALESCE(ap.status, 'pending') = 'pagamento_suspenso')
  ) THEN
    RAISE EXCEPTION 'Compras com pagamento realizado ou suspenso não podem ser editadas.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.accounts_payable_installments api
    WHERE api.account_payable_id = v_payable_id
      AND (api.payment_date IS NOT NULL OR COALESCE(api.status, 'pending') = 'pagamento_suspenso')
  ) THEN
    RAISE EXCEPTION 'Compras com parcelas pagas ou suspensas não podem ser editadas.';
  END IF;

  CASE p_purchase_type
    WHEN 'animal' THEN SELECT store_id, name, code::TEXT INTO v_store_id, v_item_name, v_item_code FROM public.animals WHERE id = p_item_id;
    WHEN 'pregnancy' THEN SELECT store_id, name, code::TEXT INTO v_store_id, v_item_name, v_item_code FROM public.pregnancy_management WHERE id = p_item_id;
    WHEN 'aspiration' THEN SELECT store_id, name, code::TEXT INTO v_store_id, v_item_name, v_item_code FROM public.aspiration_management WHERE id = p_item_id;
    WHEN 'recipient' THEN SELECT store_id, name, code::TEXT INTO v_store_id, v_item_name, v_item_code FROM public.animals WHERE id = p_item_id;
    WHEN 'semen' THEN SELECT store_id, name, code::TEXT INTO v_store_id, v_item_name, v_item_code FROM public.semen WHERE id = p_item_id;
  END CASE;

  IF v_store_id IS NULL THEN RAISE EXCEPTION 'Registro de origem não encontrado para o tipo selecionado.'; END IF;

  IF v_user_role IS DISTINCT FROM 'admin'::public.user_role AND NOT (
    v_store_id = v_user_store_id
    OR EXISTS (SELECT 1 FROM public.user_stores us WHERE us.user_id = v_user_id AND us.store_id = v_store_id)
  ) THEN
    RAISE EXCEPTION 'Usuário sem acesso à loja do item informado.';
  END IF;

  IF p_document_type IS NOT NULL AND p_document_number IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.accounts_payable ap
      WHERE ap.supplier_id = p_supplier_id AND ap.document_type = p_document_type
        AND ap.document_number = p_document_number AND COALESCE(ap.purchase_link_origin, 'manual') = 'manual'
        AND ap.id <> v_payable_id
    ) THEN
      RAISE EXCEPTION 'Já existe um título manual com o mesmo tipo e número de documento para este fornecedor.';
    END IF;
  END IF;

  IF p_installments IS NULL OR jsonb_typeof(p_installments) <> 'array' OR jsonb_array_length(p_installments) = 0 THEN
    p_installments := jsonb_build_array(jsonb_build_object('installment_number', 1, 'due_date', p_first_due_date, 'amount', ROUND(p_total_amount::NUMERIC, 2)));
  END IF;

  DELETE FROM public.accounts_payable_item_allocations
  WHERE account_payable_item_id IN (
    SELECT api.id FROM public.accounts_payable_items api WHERE api.account_payable_id = v_payable_id
  );
  DELETE FROM public.accounts_payable_items WHERE account_payable_id = v_payable_id;
  DELETE FROM public.accounts_payable_installments WHERE account_payable_id = v_payable_id;
  DELETE FROM public.purchase_semen_items WHERE purchase_id = p_purchase_id;

  v_purchase_description := COALESCE(
    NULLIF(BTRIM(p_description), ''),
    FORMAT('%s%s%s', INITCAP(p_purchase_type),
      CASE WHEN v_item_code IS NOT NULL AND v_item_code <> '' THEN ' ' || v_item_code ELSE '' END,
      CASE WHEN v_item_name IS NOT NULL AND v_item_name <> '' THEN ' - ' || v_item_name ELSE '' END)
  );

  UPDATE public.purchases
  SET supplier_id = p_supplier_id, store_id = v_store_id, product_id = p_product_id, purchase_type = p_purchase_type,
      animal_id = CASE WHEN p_purchase_type = 'animal' THEN p_item_id ELSE NULL END,
      pregnancy_id = CASE WHEN p_purchase_type = 'pregnancy' THEN p_item_id ELSE NULL END,
      aspiration_id = CASE WHEN p_purchase_type = 'aspiration' THEN p_item_id ELSE NULL END,
      recipient_id = CASE WHEN p_purchase_type = 'recipient' THEN p_item_id ELSE NULL END,
      semen_id = CASE WHEN p_purchase_type = 'semen' THEN p_item_id ELSE NULL END,
      item_name = v_item_name, item_code = v_item_code, description = v_purchase_description,
      document_type = p_document_type, document_number = p_document_number,
      negotiation_method = p_negotiation_method, purchase_date = p_purchase_date,
      issue_date = p_issue_date, first_due_date = p_first_due_date, competence_date = p_competence_date,
      total_amount = ROUND(p_total_amount::NUMERIC, 2),
      installment_count = GREATEST(jsonb_array_length(p_installments), 1),
      notes = NULLIF(BTRIM(p_notes), '')
  WHERE id = p_purchase_id;

  IF v_is_multi_semen THEN
    FOR v_semen_item IN SELECT value FROM jsonb_array_elements(p_semen_items) LOOP
      v_semen_id := (v_semen_item ->> 'semen_id')::UUID;
      v_semen_amount := ROUND(COALESCE((v_semen_item ->> 'amount')::NUMERIC, 0)::numeric, 2);
      IF v_semen_id IS NULL THEN RAISE EXCEPTION 'Item de sêmen sem identificador.'; END IF;
      IF v_semen_amount <= 0 THEN RAISE EXCEPTION 'Cada item de sêmen precisa ter valor maior que zero.'; END IF;
      INSERT INTO public.purchase_semen_items (purchase_id, semen_id, amount)
      VALUES (p_purchase_id, v_semen_id, v_semen_amount);
      v_semen_total := v_semen_total + v_semen_amount;
    END LOOP;
    IF ABS(v_semen_total - ROUND(p_total_amount::NUMERIC, 2)) > 0.01 THEN
      RAISE EXCEPTION 'A soma dos itens de sêmen deve ser igual ao valor total da compra.';
    END IF;
  ELSIF p_purchase_type = 'semen' THEN
    INSERT INTO public.purchase_semen_items (purchase_id, semen_id, amount)
    VALUES (p_purchase_id, p_item_id, ROUND(p_total_amount::NUMERIC, 2));
  END IF;

  v_payable_description := FORMAT('Compra #%s - %s', v_existing_purchase.code, v_purchase_description);

  UPDATE public.accounts_payable
  SET supplier_id = p_supplier_id, description = v_payable_description,
      document_type = p_document_type, document_number = p_document_number,
      issue_date = p_issue_date, due_date = p_first_due_date, data_competencia = p_competence_date,
      amount = ROUND(p_total_amount::NUMERIC, 2), total_amount = ROUND(p_total_amount::NUMERIC, 2),
      notes = NULLIF(BTRIM(p_notes), ''), status = 'pending',
      store_id = v_store_id, updated_by = v_user_id, payment_date = NULL,
      purchase_link_origin = 'manual', purchase_linked_at = now(), purchase_linked_by = v_user_id
  WHERE id = v_payable_id;

  INSERT INTO public.accounts_payable_items (
    account_payable_id, product_id, quantity, unit_price, total_price, store_id
  ) VALUES (
    v_payable_id, p_product_id, 1,
    ROUND(p_total_amount::NUMERIC, 2), ROUND(p_total_amount::NUMERIC, 2), v_store_id
  ) RETURNING id INTO v_payable_item_id;

  IF v_is_multi_semen THEN
    FOR v_semen_item IN SELECT value FROM jsonb_array_elements(p_semen_items) LOOP
      v_semen_id := (v_semen_item ->> 'semen_id')::UUID;
      INSERT INTO public.accounts_payable_item_allocations (
        account_payable_item_id, allocation_type, semen_id
      ) VALUES (v_payable_item_id, 'semen', v_semen_id);
    END LOOP;
  ELSE
    INSERT INTO public.accounts_payable_item_allocations (
      account_payable_item_id, allocation_type,
      animal_id, aspiration_id, pregnancy_id, recipient_id, semen_id
    ) VALUES (
      v_payable_item_id, p_purchase_type,
      CASE WHEN p_purchase_type = 'animal' THEN p_item_id ELSE NULL END,
      CASE WHEN p_purchase_type = 'aspiration' THEN p_item_id ELSE NULL END,
      CASE WHEN p_purchase_type = 'pregnancy' THEN p_item_id ELSE NULL END,
      CASE WHEN p_purchase_type = 'recipient' THEN p_item_id ELSE NULL END,
      CASE WHEN p_purchase_type = 'semen' THEN p_item_id ELSE NULL END
    );
  END IF;

  FOR v_installment IN SELECT value FROM jsonb_array_elements(p_installments) LOOP
    v_installment_count := v_installment_count + 1;
    v_installment_number := COALESCE((v_installment ->> 'installment_number')::INTEGER, v_installment_count);
    v_installment_due_date := (v_installment ->> 'due_date')::DATE;
    v_installment_amount := ROUND(COALESCE((v_installment ->> 'amount')::NUMERIC, 0)::NUMERIC, 2);

    IF v_installment_due_date IS NULL THEN RAISE EXCEPTION 'Todas as parcelas precisam ter data de vencimento.'; END IF;
    IF v_installment_amount <= 0 THEN RAISE EXCEPTION 'Todas as parcelas precisam ter valor maior que zero.'; END IF;
    v_installment_total := v_installment_total + v_installment_amount;

    INSERT INTO public.accounts_payable_installments (account_payable_id, installment_number, due_date, amount, status)
    VALUES (v_payable_id, v_installment_number, v_installment_due_date, v_installment_amount, 'pending');
  END LOOP;

  IF ABS(v_installment_total - ROUND(p_total_amount::NUMERIC, 2)) > 0.01 THEN
    RAISE EXCEPTION 'A soma das parcelas deve ser igual ao valor total da compra.';
  END IF;

  UPDATE public.purchases SET installment_count = v_installment_count WHERE id = p_purchase_id;

  RETURN QUERY SELECT p_purchase_id, v_existing_purchase.code, v_payable_id;
END;
$function$;

-- Backfill: para compras de sêmen já existentes com múltiplos itens em purchase_semen_items,
-- criar as alocações faltantes para cada sêmen adicional
INSERT INTO public.accounts_payable_item_allocations (account_payable_item_id, allocation_type, semen_id)
SELECT DISTINCT api.id, 'semen', psi.semen_id
FROM public.purchase_semen_items psi
JOIN public.accounts_payable ap ON ap.purchase_id = psi.purchase_id
JOIN public.accounts_payable_items api ON api.account_payable_id = ap.id
WHERE NOT EXISTS (
  SELECT 1 FROM public.accounts_payable_item_allocations a
  WHERE a.account_payable_item_id = api.id AND a.semen_id = psi.semen_id
);