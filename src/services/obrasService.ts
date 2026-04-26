import { supabase } from "@/integrations/supabase/client";

export interface Obra {
  id?: string;            // logical ID = codigoObra (e.g. OBRA000000001)
  codigoObra?: string;
  dataCadastro: string;
  statusProspeccao: string;
  nome: string;
  classificacao: string;
  construtora: string;
  responsavel: string;
  telefone: string;
  email: string;
  cidade: string;
  localizacao: string;
  produtoOferecido: string; // comma-separated multi-select
  estagioObra: string;
  marcouReuniao: string;
  visita: string;
  dataUltimaVisita: string;
  dataOrcamentoEnviado: string;
  proximoContato: string;
  linkOrcamentoRhoden: string;
  linkOrcamentoPrado: string;
  linkOrcamentoImab: string;
  observacoes: string;
  concorrentes: string;
}

function buildUrl(id?: string) {
  const base = import.meta.env.VITE_SUPABASE_URL;
  return id
    ? `${base}/functions/v1/obras/${encodeURIComponent(id)}`
    : `${base}/functions/v1/obras`;
}

function buildHeaders() {
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  return {
    Authorization: `Bearer ${key}`,
    apikey: key,
    "Content-Type": "application/json",
  } as Record<string, string>;
}

async function request(method: string, body?: unknown, id?: string) {
  const res = await fetch(buildUrl(id), {
    method,
    headers: buildHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Erro na operação (${res.status})`);
  }
  return res.json();
}

export async function criarObra(obra: Obra): Promise<Obra> {
  return request("POST", obra);
}

export async function atualizarObra(id: string, obra: Obra): Promise<Obra> {
  return request("PUT", obra, id);
}

export async function buscarObra(id: string): Promise<Obra> {
  return request("GET", undefined, id);
}

export async function listarObras(): Promise<Obra[]> {
  return request("GET");
}

export async function limparFollowUp(id: string): Promise<void> {
  await request("PATCH", { field: "proximoContato", value: "" }, id);
}

export async function atualizarFollowUp(id: string, data: string): Promise<void> {
  await request("PATCH", { field: "proximoContato", value: data }, id);
}

export async function atualizarCampoObra(
  id: string,
  field: keyof Obra,
  value: string,
): Promise<void> {
  await request("PATCH", { field, value }, id);
}
