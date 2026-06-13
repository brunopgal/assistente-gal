
-- Lock CRM tables to authenticated users only. Edge functions use service_role and bypass RLS.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['obras','atividades','construtoras','construtoras_atividades','pessoas']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Public read %I" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "Public insert %I" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "Public update %I" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "Public delete %I" ON public.%I', t, t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('CREATE POLICY "Authenticated read %I" ON public.%I FOR SELECT TO authenticated USING (true)', t, t);
    EXECUTE format('CREATE POLICY "Authenticated insert %I" ON public.%I FOR INSERT TO authenticated WITH CHECK (true)', t, t);
    EXECUTE format('CREATE POLICY "Authenticated update %I" ON public.%I FOR UPDATE TO authenticated USING (true) WITH CHECK (true)', t, t);
    EXECUTE format('CREATE POLICY "Authenticated delete %I" ON public.%I FOR DELETE TO authenticated USING (true)', t, t);
  END LOOP;
END $$;
