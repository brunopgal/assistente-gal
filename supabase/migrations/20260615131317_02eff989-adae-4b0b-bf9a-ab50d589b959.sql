CREATE TABLE IF NOT EXISTS public.configuracoes (
  chave TEXT PRIMARY KEY,
  valor TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.configuracoes TO authenticated;
GRANT ALL ON public.configuracoes TO service_role;

ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read configuracoes" ON public.configuracoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert configuracoes" ON public.configuracoes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update configuracoes" ON public.configuracoes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated delete configuracoes" ON public.configuracoes FOR DELETE TO authenticated USING (true);

CREATE TRIGGER configuracoes_updated_at BEFORE UPDATE ON public.configuracoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.configuracoes (chave, valor) VALUES (
  'system_prompt_michele',
  'Você é Michele, assistente de prospecção da Gal Representações. Ajude Bruno com prospecção de obras, follow-ups e relacionamento com construtoras. Seja objetiva, cordial e proativa.'
) ON CONFLICT (chave) DO NOTHING;