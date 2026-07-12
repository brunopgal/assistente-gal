-- ROLLBACK SCRIPT FOR SECURITY LOCKDOWN
-- Para reverter o lockdown, execute as duas seções abaixo no SQL Editor do Supabase 
-- ou mova este arquivo para a pasta migrations com extensão .sql

-- ========================================================
-- SEÇÃO 1: REVERTER MIGRATION 2 (AUTH SCHEMA)
-- ========================================================
DROP TRIGGER IF EXISTS on_auth_user_signup ON auth.users;
DROP FUNCTION IF EXISTS public.check_user_signup();


-- ========================================================
-- SEÇÃO 2: REVERTER MIGRATION 1 (PUBLIC SCHEMA)
-- ========================================================

-- 1. Remover políticas restritas das 6 tabelas
DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY['obras', 'atividades', 'construtoras', 'construtoras_atividades', 'pessoas', 'pessoas_atividades'];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Allow_select_restricted" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Allow_insert_restricted" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Allow_update_restricted" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Allow_delete_restricted" ON public.%I', t);
  END LOOP;
END $$;

-- 2. Restaurar políticas originais de acesso authenticated livre
-- Obras (reverte para auth_manage_obras)
CREATE POLICY "auth_manage_obras" ON public.obras FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Outras 5 tabelas (revertem para Authenticated read/insert/update/delete)
DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY['atividades', 'construtoras', 'construtoras_atividades', 'pessoas', 'pessoas_atividades'];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    EXECUTE format('CREATE POLICY "Authenticated read %I" ON public.%I FOR SELECT TO authenticated USING (true)', t, t);
    EXECUTE format('CREATE POLICY "Authenticated insert %I" ON public.%I FOR INSERT TO authenticated WITH CHECK (true)', t, t);
    EXECUTE format('CREATE POLICY "Authenticated update %I" ON public.%I FOR UPDATE TO authenticated USING (true) WITH CHECK (true)', t, t);
    EXECUTE format('CREATE POLICY "Authenticated delete %I" ON public.%I FOR DELETE TO authenticated USING (true)', t, t);
  END LOOP;
END $$;

-- 3. Remover a tabela de allowlist e a função
DROP FUNCTION IF EXISTS public.is_authorized();
DROP TABLE IF EXISTS public.usuarios_autorizados;
