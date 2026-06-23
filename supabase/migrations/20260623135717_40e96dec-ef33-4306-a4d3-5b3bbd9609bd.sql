
ALTER TABLE public.orcamento_paginas
  ADD COLUMN IF NOT EXISTS enviado_em timestamptz;

CREATE TABLE public.apresentacao_paginas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_obra text NOT NULL,
  token_apresentacao text NOT NULL,
  enviado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.apresentacao_paginas TO authenticated;
GRANT ALL ON public.apresentacao_paginas TO service_role;

CREATE UNIQUE INDEX apresentacao_paginas_codigo_obra_key ON public.apresentacao_paginas(codigo_obra);
CREATE UNIQUE INDEX apresentacao_paginas_token_key ON public.apresentacao_paginas(token_apresentacao);

ALTER TABLE public.apresentacao_paginas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_apresentacao"
  ON public.apresentacao_paginas FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_insert_apresentacao"
  ON public.apresentacao_paginas FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "authenticated_update_apresentacao"
  ON public.apresentacao_paginas FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_delete_apresentacao"
  ON public.apresentacao_paginas FOR DELETE TO authenticated USING (true);
