-- =============================================================
-- Módulo REPRODUÇÃO
-- Tabela central que consolida o ciclo reprodutivo do animal,
-- iniciando pela aspiração e acompanhando a evolução até a
-- geração de um novo animal cadastrado.
-- =============================================================

CREATE TABLE public.reproducoes (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    code INTEGER NOT NULL,
    -- Animal/mãe de origem (cadastro de animais)
    animal_mae_id UUID NOT NULL REFERENCES public.animals(id) ON DELETE CASCADE,
    -- Etapas do ciclo reprodutivo
    aspiracao_id UUID NULL REFERENCES public.aspiration_management(id) ON DELETE SET NULL,
    pos_transferencia_id UUID NULL REFERENCES public.embryo_transfer_management(id) ON DELETE SET NULL,
    prenhez_id UUID NULL REFERENCES public.pregnancy_management(id) ON DELETE SET NULL,
    animal_gerado_id UUID NULL REFERENCES public.animals(id) ON DELETE SET NULL,
    -- aspiracao | pos_transferencia | prenhez | animal_gerado | cancelada | finalizada
    status TEXT NOT NULL DEFAULT 'aspiracao',
    observacao TEXT NULL,
    -- Multiusuário (escopo por loja/fazenda, mesmo padrão do sistema)
    store_id UUID NOT NULL REFERENCES public.stores(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Row Level Security (mesmo padrão das demais tabelas de animais)
ALTER TABLE public.reproducoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view reproducoes records"
ON public.reproducoes FOR SELECT USING (true);

CREATE POLICY "Users can create reproducoes records"
ON public.reproducoes FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update reproducoes records"
ON public.reproducoes FOR UPDATE USING (true);

CREATE POLICY "Users can delete reproducoes records"
ON public.reproducoes FOR DELETE USING (true);

-- Índices
CREATE INDEX idx_reproducoes_store_id ON public.reproducoes(store_id);
CREATE INDEX idx_reproducoes_status ON public.reproducoes(status);
CREATE INDEX idx_reproducoes_animal_mae_id ON public.reproducoes(animal_mae_id);
CREATE INDEX idx_reproducoes_aspiracao_id ON public.reproducoes(aspiracao_id);
CREATE INDEX idx_reproducoes_pos_transferencia_id ON public.reproducoes(pos_transferencia_id);
CREATE INDEX idx_reproducoes_prenhez_id ON public.reproducoes(prenhez_id);

-- updated_at automático (reaproveita a função existente do projeto)
CREATE TRIGGER update_reproducoes_updated_at
BEFORE UPDATE ON public.reproducoes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================
-- Vinculação automática entre etapas
-- Reaproveita o fluxo já existente de aspiração -> pós-transferência
-- -> prenhez -> animal, sem duplicar código no frontend.
-- A cadeia existente é:
--   embryo_transfer_management.aspiration_id -> aspiration_management.id
--   pregnancy_management.embryo_transfer_id  -> embryo_transfer_management.id
--   animals.pregnancy_id                     -> pregnancy_management.id
-- =============================================================

-- 1) Aspiração gerou Pós-transferência de embrião
CREATE OR REPLACE FUNCTION public.sync_reproducao_pos_transferencia()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.aspiration_id IS NOT NULL THEN
    UPDATE public.reproducoes
       SET pos_transferencia_id = NEW.id,
           status = CASE WHEN status IN ('cancelada', 'finalizada') THEN status ELSE 'pos_transferencia' END
     WHERE aspiracao_id = NEW.aspiration_id
       AND (pos_transferencia_id IS DISTINCT FROM NEW.id OR status = 'aspiracao');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_reproducao_pos_transferencia
AFTER INSERT OR UPDATE OF aspiration_id ON public.embryo_transfer_management
FOR EACH ROW
EXECUTE FUNCTION public.sync_reproducao_pos_transferencia();

-- 2) Pós-transferência evoluiu para Prenhez
CREATE OR REPLACE FUNCTION public.sync_reproducao_prenhez()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.embryo_transfer_id IS NOT NULL THEN
    UPDATE public.reproducoes
       SET prenhez_id = NEW.id,
           status = CASE WHEN status IN ('cancelada', 'finalizada') THEN status ELSE 'prenhez' END
     WHERE pos_transferencia_id = NEW.embryo_transfer_id
       AND (prenhez_id IS DISTINCT FROM NEW.id OR status IN ('aspiracao', 'pos_transferencia'));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_reproducao_prenhez
AFTER INSERT OR UPDATE OF embryo_transfer_id ON public.pregnancy_management
FOR EACH ROW
EXECUTE FUNCTION public.sync_reproducao_prenhez();

-- 3) Prenhez gerou Animal nascido/cadastrado
CREATE OR REPLACE FUNCTION public.sync_reproducao_animal_gerado()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.pregnancy_id IS NOT NULL THEN
    UPDATE public.reproducoes
       SET animal_gerado_id = NEW.id,
           status = CASE WHEN status = 'cancelada' THEN status ELSE 'animal_gerado' END
     WHERE prenhez_id = NEW.pregnancy_id
       AND (animal_gerado_id IS DISTINCT FROM NEW.id OR status IN ('aspiracao', 'pos_transferencia', 'prenhez'));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_reproducao_animal_gerado
AFTER INSERT OR UPDATE OF pregnancy_id ON public.animals
FOR EACH ROW
EXECUTE FUNCTION public.sync_reproducao_animal_gerado();
