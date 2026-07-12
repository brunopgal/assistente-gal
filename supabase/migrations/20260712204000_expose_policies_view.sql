-- Create a public view to inspect RLS policies on CRM tables
CREATE OR REPLACE VIEW public.ver_politicas AS
SELECT schemaname, tablename, policyname, roles, cmd, qual::text, with_check::text
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename IN ('obras', 'atividades', 'construtoras', 'construtoras_atividades', 'pessoas', 'pessoas_atividades');

GRANT SELECT ON public.ver_politicas TO anon;
GRANT SELECT ON public.ver_politicas TO authenticated;
