/**
 * Lista oficial e única de status de prospecção.
 * Toda tela que lista ou filtra statusProspeccao deve importar daqui.
 */
export const STATUS_PROSPECCAO = [
  "Prospectar",
  "Em Prospecção",
  "Lead Quente",
  "Fazendo Orçamento",
  "Orçamento Enviado",
  "Negociação",
  "Fechado",
  "Perdido",
] as const;

export type StatusProspeccao = (typeof STATUS_PROSPECCAO)[number];

/**
 * Status que indicam que a obra está ativa na esteira de prospecção
 * (aparece na página Prospecção).
 */
export const STATUS_PROSPECCAO_ATIVOS = new Set<StatusProspeccao>([
  "Prospectar",
  "Em Prospecção",
  "Lead Quente",
  "Fazendo Orçamento",
  "Orçamento Enviado",
  "Negociação",
]);
