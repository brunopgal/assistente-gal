CREATE TABLE public.obras_coordenadas (
  obra_id TEXT NOT NULL PRIMARY KEY,        -- codigoObra (ex.: OBRA000000001)
  query_normalizada TEXT NOT NULL,          -- endereço+cidade normalizados usados na geocodificação
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  not_found BOOLEAN NOT NULL DEFAULT false, -- true = Nominatim respondeu vazio para esta query
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_obras_coordenadas_query ON public.obras_coordenadas(query_normalizada);

ALTER TABLE public.obras_coordenadas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read coords" ON public.obras_coordenadas FOR SELECT USING (true);
CREATE POLICY "Public insert coords" ON public.obras_coordenadas FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update coords" ON public.obras_coordenadas FOR UPDATE USING (true);
CREATE POLICY "Public delete coords" ON public.obras_coordenadas FOR DELETE USING (true);

CREATE TRIGGER update_obras_coordenadas_updated_at
BEFORE UPDATE ON public.obras_coordenadas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
