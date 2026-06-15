CREATE TABLE public.memoria_michele (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL CHECK (tipo IN ('preferencia','cliente','correcao','geral')),
  escopo text NOT NULL DEFAULT 'global',
  conteudo text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX memoria_michele_escopo_idx ON public.memoria_michele(escopo) WHERE ativo;
CREATE INDEX memoria_michele_tipo_idx ON public.memoria_michele(tipo) WHERE ativo;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.memoria_michele TO authenticated;
GRANT ALL ON public.memoria_michele TO service_role;

ALTER TABLE public.memoria_michele ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read memoria" ON public.memoria_michele
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert memoria" ON public.memoria_michele
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update memoria" ON public.memoria_michele
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete memoria" ON public.memoria_michele
  FOR DELETE TO authenticated USING (true);