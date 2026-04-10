ALTER TABLE public.purchases
ADD COLUMN IF NOT EXISTS origin_type TEXT NOT NULL DEFAULT 'manual'
CHECK (origin_type IN ('manual', 'migrated_from_accounts_payable'));

ALTER TABLE public.accounts_payable
ADD COLUMN IF NOT EXISTS purchase_link_origin TEXT
CHECK (purchase_link_origin IN ('manual', 'migration'));

ALTER TABLE public.accounts_payable
ADD COLUMN IF NOT EXISTS purchase_linked_at TIMESTAMPTZ;

ALTER TABLE public.accounts_payable
ADD COLUMN IF NOT EXISTS purchase_linked_by UUID REFERENCES public.profiles(id);

DROP INDEX IF EXISTS idx_accounts_payable_purchase_id;

CREATE INDEX IF NOT EXISTS idx_accounts_payable_purchase_id
ON public.accounts_payable(purchase_id)
WHERE purchase_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.create_purchase_with_payable(
  p_supplier_id UUID,
  p_purchase_type TEXT,
  p_item_id UUID,
  p_product_id UUID,
  p_purchase_date DATE,
  p_issue_date DATE,
  p_competence_date DATE,
  p_first_due_date DATE,
  p_total_amount NUMERIC,
  p_document_type TEXT DEFAULT NULL,
  p_document_number TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_negotiation_method TEXT DEFAULT NULL,
  p_installments JSONB DEFAULT '[]'::jsonb
)
RETURNS TABLE (
  purchase_id UUID,
  purchase_code BIGINT,
  account_payable_id UUID
)
LANGUAGE plpgsql
AS $$
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
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  IF p_supplier_id IS NULL THEN
    RAISE EXCEPTION 'Fornecedor é obrigatório.';
  END IF;

  IF p_product_id IS NULL THEN
    RAISE EXCEPTION 'Produto financeiro é obrigatório.';
  END IF;

  IF p_purchase_type NOT IN ('animal', 'pregnancy', 'aspiration', 'recipient') THEN
    RAISE EXCEPTION 'Tipo de compra inválido: %.', p_purchase_type;
  END IF;

  IF p_item_id IS NULL THEN
    RAISE EXCEPTION 'Item comprado é obrigatório.';
  END IF;

  IF p_purchase_date IS NULL OR p_issue_date IS NULL OR p_competence_date IS NULL OR p_first_due_date IS NULL THEN
    RAISE EXCEPTION 'Datas da compra, emissão, competência e primeiro vencimento são obrigatórias.';
  END IF;

  IF p_total_amount IS NULL OR p_total_amount <= 0 THEN
    RAISE EXCEPTION 'Valor total da compra deve ser maior que zero.';
  END IF;

  CASE p_purchase_type
    WHEN 'animal' THEN
      SELECT store_id, name, code::TEXT
      INTO v_store_id, v_item_name, v_item_code
      FROM public.animals
      WHERE id = p_item_id;
    WHEN 'pregnancy' THEN
      SELECT store_id, name, code::TEXT
      INTO v_store_id, v_item_name, v_item_code
      FROM public.pregnancy_management
      WHERE id = p_item_id;
    WHEN 'aspiration' THEN
      SELECT store_id, name, code::TEXT
      INTO v_store_id, v_item_name, v_item_code
      FROM public.aspiration_management
      WHERE id = p_item_id;
    WHEN 'recipient' THEN
      SELECT store_id, name, code::TEXT
      INTO v_store_id, v_item_name, v_item_code
      FROM public.animals
      WHERE id = p_item_id;
  END CASE;

  IF v_store_id IS NULL THEN
    RAISE EXCEPTION 'Registro de origem não encontrado para o tipo selecionado.';
  END IF;

  IF p_document_type IS NOT NULL AND p_document_number IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM public.accounts_payable ap
      WHERE ap.supplier_id = p_supplier_id
        AND ap.document_type = p_document_type
        AND ap.document_number = p_document_number
        AND COALESCE(ap.purchase_link_origin, 'manual') = 'manual'
    ) THEN
      RAISE EXCEPTION 'Já existe um título manual com o mesmo tipo e número de documento para este fornecedor.';
    END IF;
  END IF;

  IF p_installments IS NULL OR jsonb_typeof(p_installments) <> 'array' OR jsonb_array_length(p_installments) = 0 THEN
    p_installments := jsonb_build_array(
      jsonb_build_object(
        'installment_number', 1,
        'due_date', p_first_due_date,
        'amount', ROUND(p_total_amount::numeric, 2)
      )
    );
  END IF;

  v_purchase_description := COALESCE(
    NULLIF(BTRIM(p_description), ''),
    FORMAT(
      '%s%s%s',
      INITCAP(p_purchase_type),
      CASE WHEN v_item_code IS NOT NULL AND v_item_code <> '' THEN ' ' || v_item_code ELSE '' END,
      CASE WHEN v_item_name IS NOT NULL AND v_item_name <> '' THEN ' - ' || v_item_name ELSE '' END
    )
  );

  INSERT INTO public.purchases (
    supplier_id,
    store_id,
    product_id,
    purchase_type,
    animal_id,
    pregnancy_id,
    aspiration_id,
    recipient_id,
    item_name,
    item_code,
    description,
    document_type,
    document_number,
    negotiation_method,
    purchase_date,
    issue_date,
    first_due_date,
    competence_date,
    total_amount,
    installment_count,
    notes,
    created_by,
    origin_type
  )
  VALUES (
    p_supplier_id,
    v_store_id,
    p_product_id,
    p_purchase_type,
    CASE WHEN p_purchase_type = 'animal' THEN p_item_id ELSE NULL END,
    CASE WHEN p_purchase_type = 'pregnancy' THEN p_item_id ELSE NULL END,
    CASE WHEN p_purchase_type = 'aspiration' THEN p_item_id ELSE NULL END,
    CASE WHEN p_purchase_type = 'recipient' THEN p_item_id ELSE NULL END,
    v_item_name,
    v_item_code,
    v_purchase_description,
    p_document_type,
    p_document_number,
    p_negotiation_method,
    p_purchase_date,
    p_issue_date,
    p_first_due_date,
    p_competence_date,
    ROUND(p_total_amount::numeric, 2),
    GREATEST(jsonb_array_length(p_installments), 1),
    NULLIF(BTRIM(p_notes), ''),
    v_user_id,
    'manual'
  )
  RETURNING id, code
  INTO v_purchase_id, v_purchase_code;

  v_payable_description := FORMAT('Compra #%s - %s', v_purchase_code, v_purchase_description);

  INSERT INTO public.accounts_payable (
    supplier_id,
    purchase_id,
    description,
    document_type,
    document_number,
    issue_date,
    due_date,
    data_competencia,
    amount,
    total_amount,
    notes,
    status,
    store_id,
    account_id,
    created_by,
    updated_by,
    purchase_link_origin,
    purchase_linked_at,
    purchase_linked_by
  )
  VALUES (
    p_supplier_id,
    v_purchase_id,
    v_payable_description,
    p_document_type,
    p_document_number,
    p_issue_date,
    p_first_due_date,
    p_competence_date,
    ROUND(p_total_amount::numeric, 2),
    ROUND(p_total_amount::numeric, 2),
    NULLIF(BTRIM(p_notes), ''),
    'pending',
    v_store_id,
    NULL,
    v_user_id,
    v_user_id,
    'manual',
    now(),
    v_user_id
  )
  RETURNING id
  INTO v_payable_id;

  INSERT INTO public.accounts_payable_items (
    account_payable_id,
    product_id,
    quantity,
    unit_price,
    total_price,
    store_id
  )
  VALUES (
    v_payable_id,
    p_product_id,
    1,
    ROUND(p_total_amount::numeric, 2),
    ROUND(p_total_amount::numeric, 2),
    v_store_id
  )
  RETURNING id
  INTO v_payable_item_id;

  INSERT INTO public.accounts_payable_item_allocations (
    account_payable_item_id,
    allocation_type,
    animal_id,
    aspiration_id,
    pregnancy_id,
    recipient_id
  )
  VALUES (
    v_payable_item_id,
    p_purchase_type,
    CASE WHEN p_purchase_type = 'animal' THEN p_item_id ELSE NULL END,
    CASE WHEN p_purchase_type = 'aspiration' THEN p_item_id ELSE NULL END,
    CASE WHEN p_purchase_type = 'pregnancy' THEN p_item_id ELSE NULL END,
    CASE WHEN p_purchase_type = 'recipient' THEN p_item_id ELSE NULL END
  );

  FOR v_installment IN
    SELECT value
    FROM jsonb_array_elements(p_installments)
  LOOP
    v_installment_count := v_installment_count + 1;
    v_installment_number := COALESCE((v_installment ->> 'installment_number')::INTEGER, v_installment_count);
    v_installment_due_date := (v_installment ->> 'due_date')::DATE;
    v_installment_amount := ROUND(COALESCE((v_installment ->> 'amount')::NUMERIC, 0)::numeric, 2);

    IF v_installment_due_date IS NULL THEN
      RAISE EXCEPTION 'Todas as parcelas precisam ter data de vencimento.';
    END IF;

    IF v_installment_amount <= 0 THEN
      RAISE EXCEPTION 'Todas as parcelas precisam ter valor maior que zero.';
    END IF;

    v_installment_total := v_installment_total + v_installment_amount;

    INSERT INTO public.accounts_payable_installments (
      account_payable_id,
      installment_number,
      due_date,
      amount,
      status
    )
    VALUES (
      v_payable_id,
      v_installment_number,
      v_installment_due_date,
      v_installment_amount,
      'pending'
    );
  END LOOP;

  IF ABS(v_installment_total - ROUND(p_total_amount::numeric, 2)) > 0.01 THEN
    RAISE EXCEPTION 'A soma das parcelas deve ser igual ao valor total da compra.';
  END IF;

  UPDATE public.purchases
  SET installment_count = v_installment_count
  WHERE id = v_purchase_id;

  RETURN QUERY
  SELECT v_purchase_id, v_purchase_code, v_payable_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.migrate_accounts_payable_to_purchase(
  p_account_payable_ids UUID[],
  p_purchase_type TEXT,
  p_item_id UUID,
  p_product_id UUID,
  p_purchase_date DATE,
  p_issue_date DATE DEFAULT NULL,
  p_competence_date DATE DEFAULT NULL,
  p_first_due_date DATE DEFAULT NULL,
  p_document_type TEXT DEFAULT NULL,
  p_document_number TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_negotiation_method TEXT DEFAULT NULL
)
RETURNS TABLE (
  purchase_id UUID,
  purchase_code BIGINT,
  linked_accounts INTEGER,
  total_amount NUMERIC
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_supplier_id UUID;
  v_store_id UUID;
  v_item_name TEXT;
  v_item_code TEXT;
  v_purchase_description TEXT;
  v_purchase_id UUID;
  v_purchase_code BIGINT;
  v_selected_count INTEGER;
  v_distinct_supplier_count INTEGER;
  v_distinct_store_count INTEGER;
  v_total_amount NUMERIC(12, 2);
  v_installment_count INTEGER;
  v_resolved_issue_date DATE;
  v_resolved_competence_date DATE;
  v_resolved_first_due_date DATE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  IF p_account_payable_ids IS NULL OR array_length(p_account_payable_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Selecione ao menos um título para migrar.';
  END IF;

  IF p_product_id IS NULL THEN
    RAISE EXCEPTION 'Produto financeiro é obrigatório.';
  END IF;

  IF p_purchase_type NOT IN ('animal', 'pregnancy', 'aspiration', 'recipient') THEN
    RAISE EXCEPTION 'Tipo de compra inválido: %.', p_purchase_type;
  END IF;

  IF p_item_id IS NULL THEN
    RAISE EXCEPTION 'Item comprado é obrigatório.';
  END IF;

  IF p_purchase_date IS NULL THEN
    RAISE EXCEPTION 'Data da compra é obrigatória.';
  END IF;

  SELECT
    COUNT(*),
    COUNT(DISTINCT supplier_id),
    COUNT(DISTINCT store_id),
    ROUND(SUM(COALESCE(total_amount, amount))::numeric, 2),
    MIN(issue_date),
    MIN(data_competencia),
    MIN(due_date)
  INTO
    v_selected_count,
    v_distinct_supplier_count,
    v_distinct_store_count,
    v_total_amount,
    v_resolved_issue_date,
    v_resolved_competence_date,
    v_resolved_first_due_date
  FROM public.accounts_payable
  WHERE id = ANY(p_account_payable_ids)
    AND purchase_id IS NULL;

  IF v_selected_count <> array_length(p_account_payable_ids, 1) THEN
    RAISE EXCEPTION 'Um ou mais títulos selecionados já foram migrados ou não estão disponíveis.';
  END IF;

  IF v_distinct_supplier_count <> 1 THEN
    RAISE EXCEPTION 'Selecione apenas títulos do mesmo fornecedor.';
  END IF;

  IF v_distinct_store_count <> 1 THEN
    RAISE EXCEPTION 'Selecione apenas títulos da mesma fazenda.';
  END IF;

  SELECT supplier_id, store_id
  INTO v_supplier_id, v_store_id
  FROM public.accounts_payable
  WHERE id = ANY(p_account_payable_ids)
    AND purchase_id IS NULL
  ORDER BY due_date NULLS LAST, id
  LIMIT 1;

  IF v_supplier_id IS NULL OR v_store_id IS NULL THEN
    RAISE EXCEPTION 'Não foi possível identificar fornecedor e fazenda dos títulos selecionados.';
  END IF;

  SELECT COUNT(*)
  INTO v_installment_count
  FROM public.accounts_payable_installments
  WHERE account_payable_id = ANY(p_account_payable_ids);

  IF v_installment_count = 0 THEN
    v_installment_count := v_selected_count;
  END IF;

  CASE p_purchase_type
    WHEN 'animal' THEN
      SELECT name, code::TEXT
      INTO v_item_name, v_item_code
      FROM public.animals
      WHERE id = p_item_id;
    WHEN 'pregnancy' THEN
      SELECT name, code::TEXT
      INTO v_item_name, v_item_code
      FROM public.pregnancy_management
      WHERE id = p_item_id;
    WHEN 'aspiration' THEN
      SELECT name, code::TEXT
      INTO v_item_name, v_item_code
      FROM public.aspiration_management
      WHERE id = p_item_id;
    WHEN 'recipient' THEN
      SELECT name, code::TEXT
      INTO v_item_name, v_item_code
      FROM public.animals
      WHERE id = p_item_id;
  END CASE;

  IF v_item_name IS NULL THEN
    RAISE EXCEPTION 'Registro de origem não encontrado para o tipo selecionado.';
  END IF;

  v_purchase_description := COALESCE(
    NULLIF(BTRIM(p_description), ''),
    FORMAT(
      '%s%s%s',
      INITCAP(p_purchase_type),
      CASE WHEN v_item_code IS NOT NULL AND v_item_code <> '' THEN ' ' || v_item_code ELSE '' END,
      CASE WHEN v_item_name IS NOT NULL AND v_item_name <> '' THEN ' - ' || v_item_name ELSE '' END
    )
  );

  INSERT INTO public.purchases (
    supplier_id,
    store_id,
    product_id,
    purchase_type,
    animal_id,
    pregnancy_id,
    aspiration_id,
    recipient_id,
    item_name,
    item_code,
    description,
    document_type,
    document_number,
    negotiation_method,
    purchase_date,
    issue_date,
    first_due_date,
    competence_date,
    total_amount,
    installment_count,
    notes,
    created_by,
    origin_type
  )
  VALUES (
    v_supplier_id,
    v_store_id,
    p_product_id,
    p_purchase_type,
    CASE WHEN p_purchase_type = 'animal' THEN p_item_id ELSE NULL END,
    CASE WHEN p_purchase_type = 'pregnancy' THEN p_item_id ELSE NULL END,
    CASE WHEN p_purchase_type = 'aspiration' THEN p_item_id ELSE NULL END,
    CASE WHEN p_purchase_type = 'recipient' THEN p_item_id ELSE NULL END,
    v_item_name,
    v_item_code,
    v_purchase_description,
    p_document_type,
    p_document_number,
    p_negotiation_method,
    p_purchase_date,
    COALESCE(p_issue_date, v_resolved_issue_date, p_purchase_date),
    COALESCE(p_first_due_date, v_resolved_first_due_date, p_purchase_date),
    COALESCE(p_competence_date, v_resolved_competence_date, p_purchase_date),
    v_total_amount,
    GREATEST(v_installment_count, 1),
    NULLIF(BTRIM(p_notes), ''),
    v_user_id,
    'migrated_from_accounts_payable'
  )
  RETURNING id, code
  INTO v_purchase_id, v_purchase_code;

  UPDATE public.accounts_payable
  SET
    purchase_id = v_purchase_id,
    purchase_link_origin = 'migration',
    purchase_linked_at = now(),
    purchase_linked_by = v_user_id,
    updated_by = v_user_id
  WHERE id = ANY(p_account_payable_ids);

  RETURN QUERY
  SELECT v_purchase_id, v_purchase_code, v_selected_count, v_total_amount;
END;
$$;
