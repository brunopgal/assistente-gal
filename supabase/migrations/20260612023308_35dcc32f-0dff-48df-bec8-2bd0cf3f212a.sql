CREATE TABLE public.obras_coordenadas (
  obra_id TEXT NOT NULL PRIMARY KEY,
  query_normalizada TEXT NOT NULL,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  not_found BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.obras_coordenadas TO anon, authenticated;
GRANT ALL ON public.obras_coordenadas TO service_role;

ALTER TABLE public.obras_coordenadas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read obras_coordenadas" ON public.obras_coordenadas FOR SELECT USING (true);
CREATE POLICY "Public insert obras_coordenadas" ON public.obras_coordenadas FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update obras_coordenadas" ON public.obras_coordenadas FOR UPDATE USING (true);
CREATE POLICY "Public delete obras_coordenadas" ON public.obras_coordenadas FOR DELETE USING (true);

CREATE TRIGGER update_obras_coordenadas_updated_at
BEFORE UPDATE ON public.obras_coordenadas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();