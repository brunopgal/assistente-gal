
CREATE OR REPLACE FUNCTION public.buscar_pessoas_fuzzy(termo text, limite int DEFAULT 5)
RETURNS TABLE("codigoPessoa" text, nome text, cargo text, whatsapp text, email text, "codigoConstrutora" text, "codigoObraAtual" text, observacoes text, score real)
LANGUAGE plpgsql STABLE SET search_path = public, extensions AS $$
DECLARE
  t text := lower(unaccent(coalesce(termo,'')));
  palavras text[];
  cond text := 'TRUE';
  palavra text;
BEGIN
  IF length(trim(t)) < 2 THEN RETURN; END IF;
  palavras := regexp_split_to_array(trim(t), '\s+');
  FOREACH palavra IN ARRAY palavras LOOP
    IF length(palavra) >= 2 THEN
      cond := cond || ' AND lower(unaccent(coalesce(p.nome,''''))) ILIKE ' || quote_literal('%'||palavra||'%');
    END IF;
  END LOOP;

  RETURN QUERY EXECUTE format($q$
    SELECT * FROM (
      SELECT p."codigoPessoa", p.nome, p.cargo, p.whatsapp, p.email, p."codigoConstrutora", p."codigoObraAtual", p.observacoes,
             GREATEST(
               similarity(lower(unaccent(coalesce(p.nome,''))), %L),
               CASE WHEN %s THEN 0.9 ELSE 0 END
             )::real AS score
      FROM public.pessoas p
      WHERE (%s)
         OR similarity(lower(unaccent(coalesce(p.nome,''))), %L) > 0.3
    ) s
    ORDER BY score DESC
    LIMIT %s
  $q$, t, cond, cond, t, limite);
END $$;

CREATE OR REPLACE FUNCTION public.buscar_construtoras_fuzzy(termo text, limite int DEFAULT 5)
RETURNS TABLE(codigo text, nome text, cnpj text, status text, observacoes text, score real)
LANGUAGE plpgsql STABLE SET search_path = public, extensions AS $$
DECLARE
  t text := lower(unaccent(coalesce(termo,'')));
  palavras text[];
  cond text := 'TRUE';
  palavra text;
BEGIN
  IF length(trim(t)) < 2 THEN RETURN; END IF;
  palavras := regexp_split_to_array(trim(t), '\s+');
  FOREACH palavra IN ARRAY palavras LOOP
    IF length(palavra) >= 2 THEN
      cond := cond || ' AND lower(unaccent(coalesce(c.nome,''''))) ILIKE ' || quote_literal('%'||palavra||'%');
    END IF;
  END LOOP;

  RETURN QUERY EXECUTE format($q$
    SELECT * FROM (
      SELECT c.codigo, c.nome, c.cnpj, c.status, c.observacoes,
             GREATEST(
               similarity(lower(unaccent(coalesce(c.nome,''))), %L),
               CASE WHEN %s THEN 0.9 ELSE 0 END
             )::real AS score
      FROM public.construtoras c
      WHERE (%s)
         OR similarity(lower(unaccent(coalesce(c.nome,''))), %L) > 0.3
    ) s
    ORDER BY score DESC
    LIMIT %s
  $q$, t, cond, cond, t, limite);
END $$;

CREATE OR REPLACE FUNCTION public.buscar_obras_fuzzy(termo text, limite int DEFAULT 5)
RETURNS TABLE("codigoObra" text, nome text, construtora text, cidade text, fase_michele text, responsavel text, observacoes text, score real)
LANGUAGE plpgsql STABLE SET search_path = public, extensions AS $$
DECLARE
  t text := lower(unaccent(coalesce(termo,'')));
  palavras text[];
  condn text := 'TRUE';
  condc text := 'TRUE';
  palavra text;
BEGIN
  IF length(trim(t)) < 2 THEN RETURN; END IF;
  palavras := regexp_split_to_array(trim(t), '\s+');
  FOREACH palavra IN ARRAY palavras LOOP
    IF length(palavra) >= 2 THEN
      condn := condn || ' AND lower(unaccent(coalesce(o.nome,''''))) ILIKE ' || quote_literal('%'||palavra||'%');
      condc := condc || ' AND lower(unaccent(coalesce(o.construtora,''''))) ILIKE ' || quote_literal('%'||palavra||'%');
    END IF;
  END LOOP;

  RETURN QUERY EXECUTE format($q$
    SELECT * FROM (
      SELECT o."codigoObra", o.nome, o.construtora, o.cidade, o.fase_michele, o.responsavel, o.observacoes,
             GREATEST(
               similarity(lower(unaccent(coalesce(o.nome,''))), %L),
               similarity(lower(unaccent(coalesce(o.construtora,''))), %L),
               CASE WHEN (%s) OR (%s) THEN 0.9 ELSE 0 END
             )::real AS score
      FROM public.obras o
      WHERE (%s) OR (%s)
         OR similarity(lower(unaccent(coalesce(o.nome,''))), %L) > 0.3
         OR similarity(lower(unaccent(coalesce(o.construtora,''))), %L) > 0.3
    ) s
    ORDER BY score DESC
    LIMIT %s
  $q$, t, t, condn, condc, condn, condc, t, t, limite);
END $$;

GRANT EXECUTE ON FUNCTION public.buscar_pessoas_fuzzy(text, int) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.buscar_construtoras_fuzzy(text, int) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.buscar_obras_fuzzy(text, int) TO authenticated, service_role, anon;
