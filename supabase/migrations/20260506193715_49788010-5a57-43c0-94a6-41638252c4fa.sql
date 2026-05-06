CREATE TABLE public.pautas_reuniao (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  obra_id TEXT NOT NULL,
  conteudo TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pautas_reuniao_obra_id ON public.pautas_reuniao(obra_id);

ALTER TABLE public.pautas_reuniao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read pautas" ON public.pautas_reuniao FOR SELECT USING (true);
CREATE POLICY "Public insert pautas" ON public.pautas_reuniao FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update pautas" ON public.pautas_reuniao FOR UPDATE USING (true);
CREATE POLICY "Public delete pautas" ON public.pautas_reuniao FOR DELETE USING (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_pautas_reuniao_updated_at
BEFORE UPDATE ON public.pautas_reuniao
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();