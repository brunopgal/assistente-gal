// Serviço de Construtoras (CRUD) + Atividades/Visitas/Reuniões
// Conecta na edge function "construtoras" e nas abas:
//   - "Construtoras"
//   - "Atividades Construtoras" (atividades + visitas/reuniões na mesma aba)

export type ProdutoConstrutora = "Prado" | "Rhoden" | "Imab";
export type StatusConstrutora = "Já Cliente" | "Prospecção";
export type TipoRegistroAtividade = "atividade" | "visita" | "reuniao";

export interface Construtora {
  codigo?: string;       // Ex: CT000000001 (gerado pela edge function se vazio)
  nome: string;
  cnpj: string;
  produto: string;       // Pode ter múltiplos: "Prado, Rhoden"
  status: string;        // "Já Cliente" | "Prospecção"
  observacoes?: string;
}

export interface AtividadeConstrutora {
  idAtividade?: string;          // Ex: ATC000001
  codigoConstrutora: string;
  tipoRegistro: TipoRegistroAtividade; // atividade | visita | reuniao
  data: string;                  // DD/MM/AAAA
  horario?: string;              // HH:MM (usado em visita/reuniao)
  tipoContato?: string;          // ligação | whatsapp | email | visita
  status?: string;
  proximoContato?: string;       // DD/MM/AAAA
  comentario?: string;
  criarFollowUp?: string;        // "sim" / ""
}

import { buildAuthHeaders } from "@/lib/authFetch";

function buildUrl(path: string = "") {
  const base = import.meta.env.VITE_SUPABASE_URL;
  return `${base}/functions/v1/construtoras${path}`;
}

async function request(method: string, path: string = "", body?: unknown) {
  const headers = await buildAuthHeaders();
  const res = await fetch(buildUrl(path), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Erro na operação (${res.status})`);
  }
  return res.json();
}

// ===== Construtoras =====
export async function listarConstrutoras(): Promise<Construtora[]> {
  return request("GET");
}
export async function buscarConstrutora(codigo: string): Promise<Construtora> {
  return request("GET", `/${encodeURIComponent(codigo)}`);
}
export async function criarConstrutora(c: Construtora): Promise<Construtora> {
  return request("POST", "", c);
}
export async function atualizarConstrutora(codigo: string, c: Partial<Construtora>): Promise<Construtora> {
  return request("PUT", `/${encodeURIComponent(codigo)}`, c);
}
export async function excluirConstrutora(codigo: string): Promise<void> {
  await request("DELETE", `/${encodeURIComponent(codigo)}`);
}

export async function sincronizarConstrutoras(): Promise<{ criadas: number; total: number }> {
  return request("POST", "/sync-construtoras", {});
}
export async function sincronizarAtividadesConstrutoras(): Promise<{ espelhadas: number }> {
  return request("POST", "/sync-atividades", {});
}

// ===== Atividades Construtoras =====
export async function listarAtividadesConstrutora(codigo: string): Promise<AtividadeConstrutora[]> {
  return request("GET", `/atividades?codigo=${encodeURIComponent(codigo)}`);
}
export async function listarTodasAtividadesConstrutoras(): Promise<AtividadeConstrutora[]> {
  return request("GET", `/atividades`);
}
export async function criarAtividadeConstrutora(a: AtividadeConstrutora): Promise<AtividadeConstrutora> {
  return request("POST", `/atividades`, a);
}
export async function excluirAtividadeConstrutora(idAtividade: string): Promise<void> {
  await request("DELETE", `/atividades/${encodeURIComponent(idAtividade)}`);
}
export async function atualizarAtividadeConstrutora(
  idAtividade: string,
  patch: Partial<AtividadeConstrutora>,
): Promise<AtividadeConstrutora> {
  return request("PUT", `/atividades/${encodeURIComponent(idAtividade)}`, patch);
}
