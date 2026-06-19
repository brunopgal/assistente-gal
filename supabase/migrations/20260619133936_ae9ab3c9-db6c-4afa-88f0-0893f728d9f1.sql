CREATE TABLE public.modelos_email (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  assunto TEXT NOT NULL DEFAULT '',
  corpo_html TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.modelos_email TO authenticated;
GRANT ALL ON public.modelos_email TO service_role;

ALTER TABLE public.modelos_email ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read modelos_email"
  ON public.modelos_email FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert modelos_email"
  ON public.modelos_email FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update modelos_email"
  ON public.modelos_email FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete modelos_email"
  ON public.modelos_email FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_modelos_email_updated_at
  BEFORE UPDATE ON public.modelos_email
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();