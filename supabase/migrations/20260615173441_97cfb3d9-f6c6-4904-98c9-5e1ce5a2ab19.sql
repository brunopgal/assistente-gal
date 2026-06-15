
-- 1) Enable RLS + authenticated-only policies on tables currently open
ALTER TABLE public.cadencia_prospeccao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated manage cadencia_prospeccao" ON public.cadencia_prospeccao
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.follow_ups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated manage follow_ups" ON public.follow_ups
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.log_automacao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated manage log_automacao" ON public.log_automacao
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.orcamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated manage orcamentos" ON public.orcamentos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Ensure grants (service_role for edge functions; authenticated for app)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cadencia_prospeccao TO authenticated;
GRANT ALL ON public.cadencia_prospeccao TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.follow_ups TO authenticated;
GRANT ALL ON public.follow_ups TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.log_automacao TO authenticated;
GRANT ALL ON public.log_automacao TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orcamentos TO authenticated;
GRANT ALL ON public.orcamentos TO service_role;

-- 2) Replace public-role policies with authenticated-only on obras_coordenadas
DROP POLICY IF EXISTS "Public read obras_coordenadas" ON public.obras_coordenadas;
DROP POLICY IF EXISTS "Public insert obras_coordenadas" ON public.obras_coordenadas;
DROP POLICY IF EXISTS "Public update obras_coordenadas" ON public.obras_coordenadas;
DROP POLICY IF EXISTS "Public delete obras_coordenadas" ON public.obras_coordenadas;
CREATE POLICY "Auth read obras_coordenadas" ON public.obras_coordenadas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert obras_coordenadas" ON public.obras_coordenadas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update obras_coordenadas" ON public.obras_coordenadas FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth delete obras_coordenadas" ON public.obras_coordenadas FOR DELETE TO authenticated USING (true);

-- 3) Same for pautas_reuniao
DROP POLICY IF EXISTS "Public read pautas" ON public.pautas_reuniao;
DROP POLICY IF EXISTS "Public insert pautas" ON public.pautas_reuniao;
DROP POLICY IF EXISTS "Public update pautas" ON public.pautas_reuniao;
DROP POLICY IF EXISTS "Public delete pautas" ON public.pautas_reuniao;
CREATE POLICY "Auth read pautas" ON public.pautas_reuniao FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert pautas" ON public.pautas_reuniao FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update pautas" ON public.pautas_reuniao FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth delete pautas" ON public.pautas_reuniao FOR DELETE TO authenticated USING (true);

-- 4) Restrict orcamentos bucket uploads to authenticated; keep public read for shared links
DROP POLICY IF EXISTS "Anyone can upload orcamentos" ON storage.objects;
CREATE POLICY "Authenticated upload orcamentos" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'orcamentos');

-- 5) Make public views run with invoker privileges (no SECURITY DEFINER behavior)
ALTER VIEW public.vw_funil SET (security_invoker = on);
ALTER VIEW public.vw_followups_pendentes SET (security_invoker = on);
ALTER VIEW public.vw_acao_hoje SET (security_invoker = on);
ALTER VIEW public.vw_orcamentos_abertos SET (security_invoker = on);

-- 6) Set fixed search_path on remaining user function
ALTER FUNCTION public.set_updated_at() SET search_path = public;
