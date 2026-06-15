DROP TRIGGER IF EXISTS configuracoes_updated_at ON public.configuracoes;

CREATE OR REPLACE FUNCTION public.update_configuracoes_atualizado_em()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER configuracoes_atualizado_em
BEFORE UPDATE ON public.configuracoes
FOR EACH ROW
EXECUTE FUNCTION public.update_configuracoes_atualizado_em();