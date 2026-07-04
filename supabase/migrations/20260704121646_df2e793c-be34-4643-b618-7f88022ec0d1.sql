DROP POLICY IF EXISTS "Public read pessoas_atividades" ON public.pessoas_atividades;
DROP POLICY IF EXISTS "Public insert pessoas_atividades" ON public.pessoas_atividades;
DROP POLICY IF EXISTS "Public update pessoas_atividades" ON public.pessoas_atividades;
DROP POLICY IF EXISTS "Public delete pessoas_atividades" ON public.pessoas_atividades;

REVOKE ALL ON public.pessoas_atividades FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pessoas_atividades TO authenticated;
GRANT ALL ON public.pessoas_atividades TO service_role;

CREATE POLICY "Authenticated read pessoas_atividades" ON public.pessoas_atividades FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert pessoas_atividades" ON public.pessoas_atividades FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update pessoas_atividades" ON public.pessoas_atividades FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated delete pessoas_atividades" ON public.pessoas_atividades FOR DELETE TO authenticated USING (true);