-- Tabelas espelho da planilha Google
CREATE TABLE public.obras (
  "codigoObra" TEXT PRIMARY KEY,
  "dataCadastro" TEXT NOT NULL DEFAULT '',
  "statusProspeccao" TEXT NOT NULL DEFAULT '',
  "nome" TEXT NOT NULL DEFAULT '',
  "classificacao" TEXT NOT NULL DEFAULT '',
  "construtora" TEXT NOT NULL DEFAULT '',
  "responsavel" TEXT NOT NULL DEFAULT '',
  "telefone" TEXT NOT NULL DEFAULT '',
  "email" TEXT NOT NULL DEFAULT '',
  "cidade" TEXT NOT NULL DEFAULT '',
  "localizacao" TEXT NOT NULL DEFAULT '',
  "produtoOferecido" TEXT NOT NULL DEFAULT '',
  "estagioObra" TEXT NOT NULL DEFAULT '',
  "marcouReuniao" TEXT NOT NULL DEFAULT '',
  "visita" TEXT NOT NULL DEFAULT '',
  "dataUltimaVisita" TEXT NOT NULL DEFAULT '',
  "dataOrcamentoEnviado" TEXT NOT NULL DEFAULT '',
  "proximoContato" TEXT NOT NULL DEFAULT '',
  "linkOrcamentoRhoden" TEXT NOT NULL DEFAULT '',
  "linkOrcamentoPrado" TEXT NOT NULL DEFAULT '',
  "linkOrcamentoImab" TEXT NOT NULL DEFAULT '',
  "observacoes" TEXT NOT NULL DEFAULT '',
  "concorrentes" TEXT NOT NULL DEFAULT '',
  "prospeccaoIA" TEXT NOT NULL DEFAULT '',
  "codigoConstrutora" TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.obras TO anon, authenticated;
GRANT ALL ON public.obras TO service_role;
CREATE INDEX idx_obras_construtora ON public.obras ("codigoConstrutora");
ALTER TABLE public.obras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read obras" ON public.obras FOR SELECT USING (true);
CREATE POLICY "Public insert obras" ON public.obras FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update obras" ON public.obras FOR UPDATE USING (true);
CREATE POLICY "Public delete obras" ON public.obras FOR DELETE USING (true);
CREATE TRIGGER update_obras_updated_at BEFORE UPDATE ON public.obras FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.atividades (
  "idAtividade" TEXT PRIMARY KEY,
  "idObra" TEXT NOT NULL DEFAULT '',
  "dataAtividade" TEXT NOT NULL DEFAULT '',
  "tipoContato" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT '',
  "proximoContato" TEXT NOT NULL DEFAULT '',
  "comentario" TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.atividades TO anon, authenticated;
GRANT ALL ON public.atividades TO service_role;
CREATE INDEX idx_atividades_obra ON public.atividades ("idObra");
ALTER TABLE public.atividades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read atividades" ON public.atividades FOR SELECT USING (true);
CREATE POLICY "Public insert atividades" ON public.atividades FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update atividades" ON public.atividades FOR UPDATE USING (true);
CREATE POLICY "Public delete atividades" ON public.atividades FOR DELETE USING (true);
CREATE TRIGGER update_atividades_updated_at BEFORE UPDATE ON public.atividades FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.construtoras (
  "codigo" TEXT PRIMARY KEY,
  "nome" TEXT NOT NULL DEFAULT '',
  "cnpj" TEXT NOT NULL DEFAULT '',
  "produto" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT '',
  "observacoes" TEXT NOT NULL DEFAULT '',
  "prospeccaoIA" TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.construtoras TO anon, authenticated;
GRANT ALL ON public.construtoras TO service_role;
ALTER TABLE public.construtoras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read construtoras" ON public.construtoras FOR SELECT USING (true);
CREATE POLICY "Public insert construtoras" ON public.construtoras FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update construtoras" ON public.construtoras FOR UPDATE USING (true);
CREATE POLICY "Public delete construtoras" ON public.construtoras FOR DELETE USING (true);
CREATE TRIGGER update_construtoras_updated_at BEFORE UPDATE ON public.construtoras FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.construtoras_atividades (
  "idAtividade" TEXT PRIMARY KEY,
  "codigoConstrutora" TEXT NOT NULL DEFAULT '',
  "tipoRegistro" TEXT NOT NULL DEFAULT '',
  "data" TEXT NOT NULL DEFAULT '',
  "horario" TEXT NOT NULL DEFAULT '',
  "tipoContato" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT '',
  "proximoContato" TEXT NOT NULL DEFAULT '',
  "comentario" TEXT NOT NULL DEFAULT '',
  "criarFollowUp" TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.construtoras_atividades TO anon, authenticated;
GRANT ALL ON public.construtoras_atividades TO service_role;
CREATE INDEX idx_ct_atividades_ct ON public.construtoras_atividades ("codigoConstrutora");
ALTER TABLE public.construtoras_atividades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read construtoras_atividades" ON public.construtoras_atividades FOR SELECT USING (true);
CREATE POLICY "Public insert construtoras_atividades" ON public.construtoras_atividades FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update construtoras_atividades" ON public.construtoras_atividades FOR UPDATE USING (true);
CREATE POLICY "Public delete construtoras_atividades" ON public.construtoras_atividades FOR DELETE USING (true);
CREATE TRIGGER update_construtoras_atividades_updated_at BEFORE UPDATE ON public.construtoras_atividades FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.pessoas (
  "codigoPessoa" TEXT PRIMARY KEY,
  "codigoConstrutora" TEXT NOT NULL DEFAULT '',
  "codigoObraAtual" TEXT NOT NULL DEFAULT '',
  "nome" TEXT NOT NULL DEFAULT '',
  "cargo" TEXT NOT NULL DEFAULT '',
  "whatsapp" TEXT NOT NULL DEFAULT '',
  "email" TEXT NOT NULL DEFAULT '',
  "observacoes" TEXT NOT NULL DEFAULT '',
  "dataCadastro" TEXT NOT NULL DEFAULT '',
  "dataUltimaAtualizacao" TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pessoas TO anon, authenticated;
GRANT ALL ON public.pessoas TO service_role;
CREATE INDEX idx_pessoas_ct ON public.pessoas ("codigoConstrutora");
CREATE INDEX idx_pessoas_obra ON public.pessoas ("codigoObraAtual");
ALTER TABLE public.pessoas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read pessoas" ON public.pessoas FOR SELECT USING (true);
CREATE POLICY "Public insert pessoas" ON public.pessoas FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update pessoas" ON public.pessoas FOR UPDATE USING (true);
CREATE POLICY "Public delete pessoas" ON public.pessoas FOR DELETE USING (true);
CREATE TRIGGER update_pessoas_updated_at BEFORE UPDATE ON public.pessoas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();