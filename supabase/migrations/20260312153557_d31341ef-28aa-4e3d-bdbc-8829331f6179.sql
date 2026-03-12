ALTER TABLE public.leiloes ADD COLUMN observations text;
ALTER TABLE public.leiloes ADD COLUMN attachments jsonb DEFAULT '[]'::jsonb;