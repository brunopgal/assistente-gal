export type OrigemAtividade = "obra" | "construtora" | "pessoa";

export interface AtividadeUnificada {
  idAtividade: string;
  origem: OrigemAtividade;   // de qual tabela veio (define onde editar/excluir)
  data: string;              // normalizado (dataAtividade -> data)
  horario?: string;
  tipoRegistro?: string;
  tipoContato?: string;
  status?: string;
  proximoContato?: string;
  comentario: string;
  criarFollowUp?: string;
  // vínculos
  idObra?: string;
  codigoConstrutora?: string;
  codigoPessoa?: string;
  origIdEspelho?: string;    // id extraído de [ORIG:<id>] se for cópia espelhada
}

// Extrai o id original de uma cópia espelhada, ex: "[ORIG:ATIV000123] ..."
export function extrairOrig(comentario: string): string | undefined {
  const m = String(comentario || "").match(/\[ORIG:([A-Z0-9]+)\]/i);
  return m ? m[1].toUpperCase() : undefined;
}

// Remove cópias espelhadas cujo original JÁ está presente na lista.
export function deduplicar(lista: AtividadeUnificada[]): AtividadeUnificada[] {
  const idsPresentes = new Set(lista.map(a => a.idAtividade.toUpperCase()));
  return lista.filter(a => !(a.origIdEspelho && idsPresentes.has(a.origIdEspelho)));
}
