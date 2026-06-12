-- Migração planilha Google -> Supabase (Fase A)
-- Tabelas espelham as abas da planilha, com nomes de coluna idênticos aos campos
-- JSON que as edge functions já devolvem (camelCase), preservando o contrato da API.
-- Todos os campos de dados são TEXT para compatibilidade total com o frontend atual
-- (datas em DD/MM/AAAA como strings, exatamente como hoje).

-- ===== Obras =====
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
CREATE INDEX idx_obras_construtora ON public.obras ("codigoConstrutora");

-- ===== Atividades (por obra) =====
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
CREATE INDEX idx_atividades_obra ON public.atividades ("idObra");

-- ===== Construtoras =====
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

-- ===== Atividades de Construtoras (atividades + visitas/reuniões) =====
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
CREATE INDEX idx_ct_atividades_ct ON public.construtoras_atividades ("codigoConstrutora");

-- ===== Pessoas =====
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
CREATE INDEX idx_pessoas_ct ON public.pessoas ("codigoConstrutora");
CREATE INDEX idx_pessoas_obra ON public.pessoas ("codigoObraAtual");

-- ===== RLS (mesmo padrão de acesso das tabelas existentes) =====
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['obras', 'atividades', 'construtoras', 'construtoras_atividades', 'pessoas']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "Public read %s" ON public.%I FOR SELECT USING (true)', t, t);
    EXECUTE format('CREATE POLICY "Public insert %s" ON public.%I FOR INSERT WITH CHECK (true)', t, t);
    EXECUTE format('CREATE POLICY "Public update %s" ON public.%I FOR UPDATE USING (true)', t, t);
    EXECUTE format('CREATE POLICY "Public delete %s" ON public.%I FOR DELETE USING (true)', t, t);
    EXECUTE format('CREATE TRIGGER update_%s_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()', t, t);
  END LOOP;
END $$;
