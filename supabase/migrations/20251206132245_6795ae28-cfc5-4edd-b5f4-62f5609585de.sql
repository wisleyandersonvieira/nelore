-- Adicionar campos para log de histórico de edições no cash_control
ALTER TABLE public.cash_control
ADD COLUMN IF NOT EXISTS created_by_name TEXT,
ADD COLUMN IF NOT EXISTS edited_by_name TEXT,
ADD COLUMN IF NOT EXISTS edit_history JSONB DEFAULT '[]'::jsonb;

-- Também vamos criar um campo para status dos anexos (habilitado/inabilitado)
ALTER TABLE public.cash_control
ADD COLUMN IF NOT EXISTS attachment_status JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.cash_control.edit_history IS 'Histórico de edições: [{edited_at, edited_by, edited_by_name}]';
COMMENT ON COLUMN public.cash_control.attachment_status IS 'Status dos anexos: [{url, disabled}]';