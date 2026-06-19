-- Criação de função de trigger para gerar follow-up automático de cliente quente
CREATE OR REPLACE FUNCTION trg_criar_followup_cliente_quente()
RETURNS TRIGGER AS $$
BEGIN
  -- Se for da tabela email_eventos, só agir se tipo_evento for 'aberto' ou 'clicado' (vamos considerar 'aberto' como pedido)
  IF TG_TABLE_NAME = 'email_eventos' THEN
    IF NEW.tipo_evento != 'aberto' THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Verifica se não existe um follow-up pendente do tipo cliente_quente criado nas últimas 48h para a mesma obra
  IF NOT EXISTS (
    SELECT 1 
    FROM follow_ups 
    WHERE "codigoObra" = NEW."codigoObra" 
      AND tipo = 'cliente_quente' 
      AND status = 'pendente' 
      AND created_at >= NOW() - INTERVAL '48 hours'
  ) THEN
    INSERT INTO follow_ups (
      "codigoObra", 
      tipo, 
      descricao, 
      data_prevista, 
      prioridade, 
      responsavel, 
      status
    ) VALUES (
      NEW."codigoObra",
      'cliente_quente',
      'Cliente abriu o e-mail/acessou o site — fazer contato enquanto está quente',
      CURRENT_DATE,
      'alta',
      'bruno',
      'pendente'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para email_eventos
DROP TRIGGER IF EXISTS trg_email_eventos_cliente_quente ON email_eventos;
CREATE TRIGGER trg_email_eventos_cliente_quente
AFTER INSERT ON email_eventos
FOR EACH ROW
EXECUTE FUNCTION trg_criar_followup_cliente_quente();

-- Trigger para acessos_site
DROP TRIGGER IF EXISTS trg_acessos_site_cliente_quente ON acessos_site;
CREATE TRIGGER trg_acessos_site_cliente_quente
AFTER INSERT ON acessos_site
FOR EACH ROW
EXECUTE FUNCTION trg_criar_followup_cliente_quente();
