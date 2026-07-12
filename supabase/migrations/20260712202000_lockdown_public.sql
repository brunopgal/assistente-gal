-- 1. Criar a tabela de e-mails autorizados
CREATE TABLE IF NOT EXISTS public.usuarios_autorizados (
  email TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Ativar RLS para a tabela de allowlist
ALTER TABLE public.usuarios_autorizados ENABLE ROW LEVEL SECURITY;

-- Apenas a role service_role pode fazer modificações ou leituras gerais (ou administradores via dashboard)
CREATE POLICY "Service role full access on allowlist" ON public.usuarios_autorizados
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 2. Inserir os e-mails reais (em minúsculas)
INSERT INTO public.usuarios_autorizados (email) 
VALUES 
  ('bruno@painel.local'),
  ('bruno@gallo.com'),
  ('brunopgal@gmail.com')
ON CONFLICT (email) DO NOTHING;

-- 3. Criar a função SECURITY DEFINER para checar autorização (segura contra search_path hijacking)
CREATE OR REPLACE FUNCTION public.is_authorized()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.usuarios_autorizados
    WHERE lower(email) = lower(auth.jwt() ->> 'email')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

REVOKE ALL ON FUNCTION public.is_authorized() FROM public;
GRANT EXECUTE ON FUNCTION public.is_authorized() TO authenticated;

-- 4. Dropar de forma explícita TODAS as políticas antigas existentes
-- Obras
DROP POLICY IF EXISTS "Public read obras" ON public.obras;
DROP POLICY IF EXISTS "Public insert obras" ON public.obras;
DROP POLICY IF EXISTS "Public update obras" ON public.obras;
DROP POLICY IF EXISTS "Public delete obras" ON public.obras;
DROP POLICY IF EXISTS "Authenticated read obras" ON public.obras;
DROP POLICY IF EXISTS "Authenticated insert obras" ON public.obras;
DROP POLICY IF EXISTS "Authenticated update obras" ON public.obras;
DROP POLICY IF EXISTS "Authenticated delete obras" ON public.obras;
DROP POLICY IF EXISTS "auth_manage_obras" ON public.obras;

-- Atividades
DROP POLICY IF EXISTS "Public read atividades" ON public.atividades;
DROP POLICY IF EXISTS "Public insert atividades" ON public.atividades;
DROP POLICY IF EXISTS "Public update atividades" ON public.atividades;
DROP POLICY IF EXISTS "Public delete atividades" ON public.atividades;
DROP POLICY IF EXISTS "Authenticated read atividades" ON public.atividades;
DROP POLICY IF EXISTS "Authenticated insert atividades" ON public.atividades;
DROP POLICY IF EXISTS "Authenticated update atividades" ON public.atividades;
DROP POLICY IF EXISTS "Authenticated delete atividades" ON public.atividades;

-- Construtoras
DROP POLICY IF EXISTS "Public read construtoras" ON public.construtoras;
DROP POLICY IF EXISTS "Public insert construtoras" ON public.construtoras;
DROP POLICY IF EXISTS "Public update construtoras" ON public.construtoras;
DROP POLICY IF EXISTS "Public delete construtoras" ON public.construtoras;
DROP POLICY IF EXISTS "Authenticated read construtoras" ON public.construtoras;
DROP POLICY IF EXISTS "Authenticated insert construtoras" ON public.construtoras;
DROP POLICY IF EXISTS "Authenticated update construtoras" ON public.construtoras;
DROP POLICY IF EXISTS "Authenticated delete construtoras" ON public.construtoras;

-- Construtoras Atividades
DROP POLICY IF EXISTS "Public read construtoras_atividades" ON public.construtoras_atividades;
DROP POLICY IF EXISTS "Public insert construtoras_atividades" ON public.construtoras_atividades;
DROP POLICY IF EXISTS "Public update construtoras_atividades" ON public.construtoras_atividades;
DROP POLICY IF EXISTS "Public delete construtoras_atividades" ON public.construtoras_atividades;
DROP POLICY IF EXISTS "Authenticated read construtoras_atividades" ON public.construtoras_atividades;
DROP POLICY IF EXISTS "Authenticated insert construtoras_atividades" ON public.construtoras_atividades;
DROP POLICY IF EXISTS "Authenticated update construtoras_atividades" ON public.construtoras_atividades;
DROP POLICY IF EXISTS "Authenticated delete construtoras_atividades" ON public.construtoras_atividades;

-- Pessoas
DROP POLICY IF EXISTS "Public read pessoas" ON public.pessoas;
DROP POLICY IF EXISTS "Public insert pessoas" ON public.pessoas;
DROP POLICY IF EXISTS "Public update pessoas" ON public.pessoas;
DROP POLICY IF EXISTS "Public delete pessoas" ON public.pessoas;
DROP POLICY IF EXISTS "Authenticated read pessoas" ON public.pessoas;
DROP POLICY IF EXISTS "Authenticated insert pessoas" ON public.pessoas;
DROP POLICY IF EXISTS "Authenticated update pessoas" ON public.pessoas;
DROP POLICY IF EXISTS "Authenticated delete pessoas" ON public.pessoas;

-- Pessoas Atividades
DROP POLICY IF EXISTS "Public read pessoas_atividades" ON public.pessoas_atividades;
DROP POLICY IF EXISTS "Public insert pessoas_atividades" ON public.pessoas_atividades;
DROP POLICY IF EXISTS "Public update pessoas_atividades" ON public.pessoas_atividades;
DROP POLICY IF EXISTS "Public delete pessoas_atividades" ON public.pessoas_atividades;
DROP POLICY IF EXISTS "Authenticated read pessoas_atividades" ON public.pessoas_atividades;
DROP POLICY IF EXISTS "Authenticated insert pessoas_atividades" ON public.pessoas_atividades;
DROP POLICY IF EXISTS "Authenticated update pessoas_atividades" ON public.pessoas_atividades;
DROP POLICY IF EXISTS "Authenticated delete pessoas_atividades" ON public.pessoas_atividades;

-- 5. Criar as novas políticas RLS restritas para as 6 CRM Tables
-- Obras
CREATE POLICY "Allow_select_restricted" ON public.obras FOR SELECT TO authenticated USING (public.is_authorized());
CREATE POLICY "Allow_insert_restricted" ON public.obras FOR INSERT TO authenticated WITH CHECK (public.is_authorized());
CREATE POLICY "Allow_update_restricted" ON public.obras FOR UPDATE TO authenticated USING (public.is_authorized()) WITH CHECK (public.is_authorized());
CREATE POLICY "Allow_delete_restricted" ON public.obras FOR DELETE TO authenticated USING (public.is_authorized());

-- Atividades
CREATE POLICY "Allow_select_restricted" ON public.atividades FOR SELECT TO authenticated USING (public.is_authorized());
CREATE POLICY "Allow_insert_restricted" ON public.atividades FOR INSERT TO authenticated WITH CHECK (public.is_authorized());
CREATE POLICY "Allow_update_restricted" ON public.atividades FOR UPDATE TO authenticated USING (public.is_authorized()) WITH CHECK (public.is_authorized());
CREATE POLICY "Allow_delete_restricted" ON public.atividades FOR DELETE TO authenticated USING (public.is_authorized());

-- Construtoras
CREATE POLICY "Allow_select_restricted" ON public.construtoras FOR SELECT TO authenticated USING (public.is_authorized());
CREATE POLICY "Allow_insert_restricted" ON public.construtoras FOR INSERT TO authenticated WITH CHECK (public.is_authorized());
CREATE POLICY "Allow_update_restricted" ON public.construtoras FOR UPDATE TO authenticated USING (public.is_authorized()) WITH CHECK (public.is_authorized());
CREATE POLICY "Allow_delete_restricted" ON public.construtoras FOR DELETE TO authenticated USING (public.is_authorized());

-- Construtoras Atividades
CREATE POLICY "Allow_select_restricted" ON public.construtoras_atividades FOR SELECT TO authenticated USING (public.is_authorized());
CREATE POLICY "Allow_insert_restricted" ON public.construtoras_atividades FOR INSERT TO authenticated WITH CHECK (public.is_authorized());
CREATE POLICY "Allow_update_restricted" ON public.construtoras_atividades FOR UPDATE TO authenticated USING (public.is_authorized()) WITH CHECK (public.is_authorized());
CREATE POLICY "Allow_delete_restricted" ON public.construtoras_atividades FOR DELETE TO authenticated USING (public.is_authorized());

-- Pessoas
CREATE POLICY "Allow_select_restricted" ON public.pessoas FOR SELECT TO authenticated USING (public.is_authorized());
CREATE POLICY "Allow_insert_restricted" ON public.pessoas FOR INSERT TO authenticated WITH CHECK (public.is_authorized());
CREATE POLICY "Allow_update_restricted" ON public.pessoas FOR UPDATE TO authenticated USING (public.is_authorized()) WITH CHECK (public.is_authorized());
CREATE POLICY "Allow_delete_restricted" ON public.pessoas FOR DELETE TO authenticated USING (public.is_authorized());

-- Pessoas Atividades
CREATE POLICY "Allow_select_restricted" ON public.pessoas_atividades FOR SELECT TO authenticated USING (public.is_authorized());
CREATE POLICY "Allow_insert_restricted" ON public.pessoas_atividades FOR INSERT TO authenticated WITH CHECK (public.is_authorized());
CREATE POLICY "Allow_update_restricted" ON public.pessoas_atividades FOR UPDATE TO authenticated USING (public.is_authorized()) WITH CHECK (public.is_authorized());
CREATE POLICY "Allow_delete_restricted" ON public.pessoas_atividades FOR DELETE TO authenticated USING (public.is_authorized());
