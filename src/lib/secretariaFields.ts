// Mapeia nomes PT (planilha) -> chaves do form (ObraFormValues)
export const FIELD_MAP: Record<string, string> = {
  "ID": "codigoObra",
  "Data de cadastro": "dataCadastro",
  "Status da prospecção": "statusProspeccao",
  "Nome da obra": "nome",
  "Classificação da obra": "classificacao",
  "Construtora/Cliente": "construtora",
  "Responsável/Contato": "responsavel",
  "Telefone/Whastapp": "telefone",
  "Email": "email",
  "Cidade Obra": "cidade",
  "Localização/Bairro Obra": "localizacao",
  "Produto Oferecido": "produtoOferecido",
  "Estágio da obra": "estagioObra",
  "Marcou Reunião?": "marcouReuniao",
  "Visita": "visita",
  "Data da última visita": "dataUltimaVisita",
  "Data orçamento enviado": "dataOrcamentoEnviado",
  "Próximo contato/Follow up": "proximoContato",
  "Link do orçamento/PDF RHODEN": "linkOrcamentoRhoden",
  "Link do orçamento/PDF PRADO": "linkOrcamentoPrado",
  "Link do orçamento/PDF IMAB": "linkOrcamentoImab",
  "Observação": "observacoes",
  "Concorrentes": "concorrentes",
};

export function mapFieldsToForm(
  fields: Record<string, string> | undefined,
): Record<string, string> {
  if (!fields) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(fields)) {
    const key = FIELD_MAP[k];
    if (key) out[key] = String(v ?? "");
  }
  return out;
}

export interface SecretariaAction {
  modo: "nova" | "editar" | "executar" | "analisar" | "perguntar" | "conversa";
  id?: string;
  campos?: Record<string, string>;
  criar?: boolean;
  consulta?: string;
  mensagem?: string;
  salvarDica?: string;
  limparDicas?: boolean;
}
