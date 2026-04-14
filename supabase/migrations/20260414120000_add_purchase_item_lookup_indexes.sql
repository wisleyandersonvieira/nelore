-- Performance: acelera a soma de compras por cadastro usada no modulo de Comissoes.
--
-- Contexto: o formulario de comissoes consulta todas as compras relacionadas a um
-- animal, prenhez ou aspiracao para montar a base de compra acumulada. Como a tabela
-- purchases e polimorfica por tipo, indices parciais por FK evitam varreduras amplas
-- e mantem o lookup preciso para cada cadastro.

CREATE INDEX IF NOT EXISTS idx_purchases_animal_id_lookup
  ON public.purchases (animal_id)
  WHERE purchase_type = 'animal' AND animal_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_purchases_pregnancy_id_lookup
  ON public.purchases (pregnancy_id)
  WHERE purchase_type = 'pregnancy' AND pregnancy_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_purchases_aspiration_id_lookup
  ON public.purchases (aspiration_id)
  WHERE purchase_type = 'aspiration' AND aspiration_id IS NOT NULL;

-- Preparado para eventual extensao do mesmo padrao no fluxo de receptoras.
CREATE INDEX IF NOT EXISTS idx_purchases_recipient_id_lookup
  ON public.purchases (recipient_id)
  WHERE purchase_type = 'recipient' AND recipient_id IS NOT NULL;
