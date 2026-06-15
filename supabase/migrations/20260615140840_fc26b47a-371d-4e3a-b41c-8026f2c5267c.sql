
ALTER TABLE public.mensagens_michele
  ADD COLUMN IF NOT EXISTS acao_status text,
  ADD COLUMN IF NOT EXISTS acao_dados jsonb,
  ADD COLUMN IF NOT EXISTS memoria_status text,
  ADD COLUMN IF NOT EXISTS memoria_dados jsonb;

ALTER TABLE public.mensagens_michele
  DROP CONSTRAINT IF EXISTS mensagens_michele_acao_status_chk;
ALTER TABLE public.mensagens_michele
  ADD CONSTRAINT mensagens_michele_acao_status_chk
  CHECK (acao_status IS NULL OR acao_status IN ('pendente','aprovada','cancelada'));

ALTER TABLE public.mensagens_michele
  DROP CONSTRAINT IF EXISTS mensagens_michele_memoria_status_chk;
ALTER TABLE public.mensagens_michele
  ADD CONSTRAINT mensagens_michele_memoria_status_chk
  CHECK (memoria_status IS NULL OR memoria_status IN ('pendente','guardada','descartada'));
