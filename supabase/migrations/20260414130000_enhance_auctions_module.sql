-- Performance e consistencia para o modulo de Leiloes.
--
-- Esta migration adiciona:
-- 1. indices para consultas por auction_id nos cadastros relacionados;
-- 2. uma funcao paginada com contagem agregada de cadastros vinculados;
-- 3. uma protecao no banco para impedir exclusao de leiloes com vinculos.

CREATE INDEX IF NOT EXISTS idx_leiloes_matrix_date
  ON public.leiloes (matrix_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_leiloes_store_date
  ON public.leiloes (store_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_animals_auction_id_lookup
  ON public.animals (auction_id)
  WHERE auction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pregnancy_management_auction_id_lookup
  ON public.pregnancy_management (auction_id)
  WHERE auction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_aspiration_management_auction_id_lookup
  ON public.aspiration_management (auction_id)
  WHERE auction_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.list_leiloes_overview(
  p_store_ids UUID[] DEFAULT NULL,
  p_matrix_id UUID DEFAULT NULL,
  p_name TEXT DEFAULT NULL,
  p_date_from DATE DEFAULT NULL,
  p_date_to DATE DEFAULT NULL,
  p_sort_field TEXT DEFAULT 'date',
  p_sort_direction TEXT DEFAULT 'desc',
  p_page INTEGER DEFAULT 1,
  p_page_size INTEGER DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  code INTEGER,
  name TEXT,
  date DATE,
  city TEXT,
  is_active BOOLEAN,
  observations TEXT,
  attachments JSONB,
  store_id UUID,
  matrix_id UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  animal_count BIGINT,
  pregnancy_count BIGINT,
  aspiration_count BIGINT,
  linked_records_count BIGINT,
  total_count BIGINT
)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_page INTEGER := GREATEST(COALESCE(p_page, 1), 1);
  v_page_size INTEGER := LEAST(GREATEST(COALESCE(p_page_size, 20), 1), 100);
  v_offset INTEGER := (GREATEST(COALESCE(p_page, 1), 1) - 1) * LEAST(GREATEST(COALESCE(p_page_size, 20), 1), 100);
  v_sort_field TEXT := CASE
    WHEN p_sort_field IN ('code', 'name', 'date', 'city', 'linked_records_count') THEN p_sort_field
    ELSE 'date'
  END;
  v_sort_direction TEXT := CASE
    WHEN LOWER(COALESCE(p_sort_direction, 'desc')) IN ('asc', 'desc') THEN LOWER(COALESCE(p_sort_direction, 'desc'))
    ELSE 'desc'
  END;
  v_name TEXT := NULLIF(BTRIM(p_name), '');
BEGIN
  RETURN QUERY
  WITH filtered AS (
    SELECT l.*
    FROM public.leiloes l
    WHERE l.is_active = true
      AND (
        p_matrix_id IS NULL
        OR l.matrix_id = p_matrix_id
      )
      AND (
        p_matrix_id IS NOT NULL
        OR p_store_ids IS NULL
        OR COALESCE(array_length(p_store_ids, 1), 0) = 0
        OR l.store_id = ANY(p_store_ids)
      )
      AND (
        v_name IS NULL
        OR l.name ILIKE '%' || v_name || '%'
      )
      AND (
        p_date_from IS NULL
        OR l.date >= p_date_from
      )
      AND (
        p_date_to IS NULL
        OR l.date <= p_date_to
      )
  ),
  animal_counts AS (
    SELECT a.auction_id, COUNT(*)::BIGINT AS total
    FROM public.animals a
    INNER JOIN filtered f
      ON f.id = a.auction_id
    GROUP BY a.auction_id
  ),
  pregnancy_counts AS (
    SELECT p.auction_id, COUNT(*)::BIGINT AS total
    FROM public.pregnancy_management p
    INNER JOIN filtered f
      ON f.id = p.auction_id
    GROUP BY p.auction_id
  ),
  aspiration_counts AS (
    SELECT a.auction_id, COUNT(*)::BIGINT AS total
    FROM public.aspiration_management a
    INNER JOIN filtered f
      ON f.id = a.auction_id
    GROUP BY a.auction_id
  ),
  counted AS (
    SELECT
      f.id,
      f.code,
      f.name,
      f.date,
      f.city,
      f.is_active,
      f.observations,
      f.attachments,
      f.store_id,
      f.matrix_id,
      f.created_at,
      f.updated_at,
      COALESCE(ac.total, 0) AS animal_count,
      COALESCE(pc.total, 0) AS pregnancy_count,
      COALESCE(ascn.total, 0) AS aspiration_count,
      COALESCE(ac.total, 0) + COALESCE(pc.total, 0) + COALESCE(ascn.total, 0) AS linked_records_count
    FROM filtered f
    LEFT JOIN animal_counts ac
      ON ac.auction_id = f.id
    LEFT JOIN pregnancy_counts pc
      ON pc.auction_id = f.id
    LEFT JOIN aspiration_counts ascn
      ON ascn.auction_id = f.id
  ),
  total AS (
    SELECT COUNT(*)::BIGINT AS total_count
    FROM filtered
  )
  SELECT
    c.id,
    c.code,
    c.name,
    c.date,
    c.city,
    c.is_active,
    c.observations,
    c.attachments,
    c.store_id,
    c.matrix_id,
    c.created_at,
    c.updated_at,
    c.animal_count,
    c.pregnancy_count,
    c.aspiration_count,
    c.linked_records_count,
    t.total_count
  FROM counted c
  CROSS JOIN total t
  ORDER BY
    CASE WHEN v_sort_field = 'code' AND v_sort_direction = 'asc' THEN c.code END ASC NULLS LAST,
    CASE WHEN v_sort_field = 'code' AND v_sort_direction = 'desc' THEN c.code END DESC NULLS LAST,
    CASE WHEN v_sort_field = 'name' AND v_sort_direction = 'asc' THEN LOWER(c.name) END ASC NULLS LAST,
    CASE WHEN v_sort_field = 'name' AND v_sort_direction = 'desc' THEN LOWER(c.name) END DESC NULLS LAST,
    CASE WHEN v_sort_field = 'date' AND v_sort_direction = 'asc' THEN c.date END ASC NULLS LAST,
    CASE WHEN v_sort_field = 'date' AND v_sort_direction = 'desc' THEN c.date END DESC NULLS LAST,
    CASE WHEN v_sort_field = 'city' AND v_sort_direction = 'asc' THEN LOWER(c.city) END ASC NULLS LAST,
    CASE WHEN v_sort_field = 'city' AND v_sort_direction = 'desc' THEN LOWER(c.city) END DESC NULLS LAST,
    CASE WHEN v_sort_field = 'linked_records_count' AND v_sort_direction = 'asc' THEN c.linked_records_count END ASC NULLS LAST,
    CASE WHEN v_sort_field = 'linked_records_count' AND v_sort_direction = 'desc' THEN c.linked_records_count END DESC NULLS LAST,
    c.date DESC,
    c.code DESC
  OFFSET v_offset
  LIMIT v_page_size;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_delete_leilao_with_links()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_linked_count BIGINT := 0;
BEGIN
  SELECT
    COALESCE((SELECT COUNT(*) FROM public.animals a WHERE a.auction_id = OLD.id), 0) +
    COALESCE((SELECT COUNT(*) FROM public.pregnancy_management p WHERE p.auction_id = OLD.id), 0) +
    COALESCE((SELECT COUNT(*) FROM public.aspiration_management am WHERE am.auction_id = OLD.id), 0)
  INTO v_linked_count;

  IF v_linked_count > 0 THEN
    RAISE EXCEPTION 'Este leilão não pode ser excluído porque possui cadastros vinculados.';
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS prevent_delete_leilao_with_links ON public.leiloes;

CREATE TRIGGER prevent_delete_leilao_with_links
BEFORE DELETE ON public.leiloes
FOR EACH ROW
EXECUTE FUNCTION public.prevent_delete_leilao_with_links();
