
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated manage produtos" ON public.produtos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.produtos TO authenticated;
GRANT ALL ON public.produtos TO service_role;
