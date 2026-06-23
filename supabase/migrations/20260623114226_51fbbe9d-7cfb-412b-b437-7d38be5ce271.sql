
CREATE TABLE public.orcamento_paginas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_obra text NOT NULL,
  titulo_versao text NOT NULL DEFAULT '',
  ativo boolean NOT NULL DEFAULT true,
  blocos jsonb NOT NULL DEFAULT '[]'::jsonb,
  token_orcamento text NOT NULL,
  token_apresentacao text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orcamento_paginas TO authenticated;
GRANT ALL ON public.orcamento_paginas TO service_role;
ALTER TABLE public.orcamento_paginas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth full access orcamento_paginas" ON public.orcamento_paginas
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_orcamento_paginas_codigo_obra ON public.orcamento_paginas(codigo_obra);
CREATE UNIQUE INDEX idx_orcamento_paginas_token_orcamento ON public.orcamento_paginas(token_orcamento);
CREATE UNIQUE INDEX idx_orcamento_paginas_token_apresentacao ON public.orcamento_paginas(token_apresentacao);
CREATE TRIGGER trg_orcamento_paginas_updated_at
  BEFORE UPDATE ON public.orcamento_paginas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.orcamento_aberturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pagina_id uuid NOT NULL REFERENCES public.orcamento_paginas(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  aberto_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orcamento_aberturas TO authenticated;
GRANT ALL ON public.orcamento_aberturas TO service_role;
ALTER TABLE public.orcamento_aberturas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth full access orcamento_aberturas" ON public.orcamento_aberturas
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_orcamento_aberturas_pagina_id ON public.orcamento_aberturas(pagina_id);
