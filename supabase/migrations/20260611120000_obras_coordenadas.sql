-- Fase 2 do Mapa de Obras: coordenadas geocodificadas persistidas e compartilhadas.
-- A geocodificação acontece uma única vez por endereço (no cadastro/edição da obra
-- ou no backfill feito pelo mapa) e fica disponível para todos os usuários.

CREATE TABLE public.obras_coordenadas (
  obra_id TEXT NOT NULL PRIMARY KEY,          -- codigoObra (ex.: OBRA000000001)
  query_normalizada TEXT NOT NULL,            -- endereço+cidade normalizados usados na geocodificação
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  not_found BOOLEAN NOT NULL DEFAULT false,   -- true = Nominatim respondeu vazio para esta query
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.obras_coordenadas ENABLE ROW LEVEL SECURITY;

-- Mesmo padrão de acesso já usado em pautas_reuniao
CREATE POLICY "Public read obras_coordenadas" ON public.obras_coordenadas FOR SELECT USING (true);
CREATE POLICY "Public insert obras_coordenadas" ON public.obras_coordenadas FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update obras_coordenadas" ON public.obras_coordenadas FOR UPDATE USING (true);
CREATE POLICY "Public delete obras_coordenadas" ON public.obras_coordenadas FOR DELETE USING (true);

-- Reaproveita a função de updated_at criada na migration de pautas_reuniao
CREATE TRIGGER update_obras_coordenadas_updated_at
BEFORE UPDATE ON public.obras_coordenadas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
