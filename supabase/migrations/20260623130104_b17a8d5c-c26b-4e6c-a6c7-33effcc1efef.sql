DROP POLICY IF EXISTS "anon_read_obras" ON public.obras;
REVOKE SELECT ON public.obras FROM anon;