-- 1) Configurar RLS e Privilégios na tabela orcamento_paginas
-- Conceder permissão de SELECT para usuários anônimos (anon)
GRANT SELECT ON public.orcamento_paginas TO anon;

-- Criar a policy de SELECT para o papel anon que restringe a leitura a páginas ativas
DROP POLICY IF EXISTS "anon_read_active_orcamento_paginas" ON public.orcamento_paginas;
CREATE POLICY "anon_read_active_orcamento_paginas" ON public.orcamento_paginas
  FOR SELECT TO anon USING (ativo = true);

-- 2) Reconfigurar RLS e Privilégios na tabela obras
-- Remover privilégios antigos de anon na tabela obras (evitando que anon faça insert/update/delete)
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.obras FROM anon;

-- Conceder SELECT apenas para as colunas necessárias ao cabeçalho público (nome, construtora, codigoObra)
GRANT SELECT ("codigoObra", "nome", "construtora") ON public.obras TO anon;

-- Excluir as policies antigas com privilégios públicos irrestritos em obras
DROP POLICY IF EXISTS "Public read obras" ON public.obras;
DROP POLICY IF EXISTS "Public insert obras" ON public.obras;
DROP POLICY IF EXISTS "Public update obras" ON public.obras;
DROP POLICY IF EXISTS "Public delete obras" ON public.obras;

-- Criar a policy de SELECT para anon em obras (limitada em colunas pelo GRANT acima)
DROP POLICY IF EXISTS "anon_read_obras" ON public.obras;
CREATE POLICY "anon_read_obras" ON public.obras
  FOR SELECT TO anon USING (true);

-- Criar policy com acesso total para usuários autenticados (manter comportamento do app)
DROP POLICY IF EXISTS "auth_manage_obras" ON public.obras;
CREATE POLICY "auth_manage_obras" ON public.obras
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
