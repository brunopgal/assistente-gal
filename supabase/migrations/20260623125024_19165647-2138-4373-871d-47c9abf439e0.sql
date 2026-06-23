GRANT SELECT ON public.orcamento_paginas TO anon;

DROP POLICY IF EXISTS "anon_read_active_orcamento_paginas" ON public.orcamento_paginas;
CREATE POLICY "anon_read_active_orcamento_paginas" ON public.orcamento_paginas
  FOR SELECT TO anon USING (ativo = true);

REVOKE SELECT, INSERT, UPDATE, DELETE ON public.obras FROM anon;

GRANT SELECT ("codigoObra", "nome", "construtora") ON public.obras TO anon;

DROP POLICY IF EXISTS "Public read obras" ON public.obras;
DROP POLICY IF EXISTS "Public insert obras" ON public.obras;
DROP POLICY IF EXISTS "Public update obras" ON public.obras;
DROP POLICY IF EXISTS "Public delete obras" ON public.obras;

DROP POLICY IF EXISTS "anon_read_obras" ON public.obras;
CREATE POLICY "anon_read_obras" ON public.obras
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "auth_manage_obras" ON public.obras;
CREATE POLICY "auth_manage_obras" ON public.obras
  FOR ALL TO authenticated USING (true) WITH CHECK (true);