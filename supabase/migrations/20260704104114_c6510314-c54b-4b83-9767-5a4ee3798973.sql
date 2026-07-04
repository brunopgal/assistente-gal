ALTER TABLE public.atividades ADD COLUMN IF NOT EXISTS "codigoConstrutora" TEXT NOT NULL DEFAULT '';
ALTER TABLE public.atividades ADD COLUMN IF NOT EXISTS "codigoPessoa" TEXT NOT NULL DEFAULT '';

ALTER TABLE public.construtoras_atividades ADD COLUMN IF NOT EXISTS "idObra" TEXT NOT NULL DEFAULT '';
ALTER TABLE public.construtoras_atividades ADD COLUMN IF NOT EXISTS "codigoPessoa" TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS public.pessoas_atividades (
  "idAtividade" TEXT PRIMARY KEY,
  "codigoPessoa" TEXT NOT NULL DEFAULT '',
  "tipoRegistro" TEXT NOT NULL DEFAULT 'atividade',
  "data" TEXT NOT NULL DEFAULT '',
  "horario" TEXT NOT NULL DEFAULT '',
  "tipoContato" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT '',
  "proximoContato" TEXT NOT NULL DEFAULT '',
  "comentario" TEXT NOT NULL DEFAULT '',
  "criarFollowUp" TEXT NOT NULL DEFAULT '',
  "idObra" TEXT NOT NULL DEFAULT '',
  "codigoConstrutora" TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pessoas_atividades TO anon, authenticated;
GRANT ALL ON public.pessoas_atividades TO service_role;

CREATE INDEX IF NOT EXISTS idx_pessoas_atividades_pessoa ON public.pessoas_atividades ("codigoPessoa");
CREATE INDEX IF NOT EXISTS idx_pessoas_atividades_obra ON public.pessoas_atividades ("idObra");
CREATE INDEX IF NOT EXISTS idx_pessoas_atividades_construtora ON public.pessoas_atividades ("codigoConstrutora");

CREATE INDEX IF NOT EXISTS idx_atividades_pessoa ON public.atividades ("codigoPessoa");
CREATE INDEX IF NOT EXISTS idx_atividades_construtora ON public.atividades ("codigoConstrutora");
CREATE INDEX IF NOT EXISTS idx_ct_atividades_obra ON public.construtoras_atividades ("idObra");
CREATE INDEX IF NOT EXISTS idx_ct_atividades_pessoa ON public.construtoras_atividades ("codigoPessoa");

ALTER TABLE public.pessoas_atividades ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='pessoas_atividades' AND policyname='Public read pessoas_atividades')
    THEN CREATE POLICY "Public read pessoas_atividades" ON public.pessoas_atividades FOR SELECT USING (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='pessoas_atividades' AND policyname='Public insert pessoas_atividades')
    THEN CREATE POLICY "Public insert pessoas_atividades" ON public.pessoas_atividades FOR INSERT WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='pessoas_atividades' AND policyname='Public update pessoas_atividades')
    THEN CREATE POLICY "Public update pessoas_atividades" ON public.pessoas_atividades FOR UPDATE USING (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='pessoas_atividades' AND policyname='Public delete pessoas_atividades')
    THEN CREATE POLICY "Public delete pessoas_atividades" ON public.pessoas_atividades FOR DELETE USING (true); END IF;
END $$;

DROP TRIGGER IF EXISTS update_pessoas_atividades_updated_at ON public.pessoas_atividades;
CREATE TRIGGER update_pessoas_atividades_updated_at
  BEFORE UPDATE ON public.pessoas_atividades
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();