DROP POLICY IF EXISTS "anon_read_active_orcamento_paginas" ON public.orcamento_paginas;
REVOKE SELECT ON public.orcamento_paginas FROM anon;