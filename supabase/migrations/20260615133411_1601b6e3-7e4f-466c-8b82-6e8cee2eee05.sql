CREATE TABLE public.conversas_michele (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL DEFAULT 'Nova conversa',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversas_michele TO authenticated;
GRANT ALL ON public.conversas_michele TO service_role;

ALTER TABLE public.conversas_michele ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read conversas" ON public.conversas_michele
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert conversas" ON public.conversas_michele
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update conversas" ON public.conversas_michele
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete conversas" ON public.conversas_michele
  FOR DELETE TO authenticated USING (true);

CREATE TRIGGER conversas_michele_updated_at
  BEFORE UPDATE ON public.conversas_michele
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.mensagens_michele (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id uuid NOT NULL REFERENCES public.conversas_michele(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX mensagens_michele_conversa_id_idx ON public.mensagens_michele(conversa_id, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mensagens_michele TO authenticated;
GRANT ALL ON public.mensagens_michele TO service_role;

ALTER TABLE public.mensagens_michele ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read mensagens" ON public.mensagens_michele
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert mensagens" ON public.mensagens_michele
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update mensagens" ON public.mensagens_michele
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete mensagens" ON public.mensagens_michele
  FOR DELETE TO authenticated USING (true);