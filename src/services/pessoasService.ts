// Serviço de Pessoas (contatos relacionados a Construtoras e opcionalmente a Obras)
import { buildAuthHeaders } from "@/lib/authFetch";

export const CARGO_OPTIONS = [
  "Não Informado",
  "Compras",
  "Engenheiro",
  "Arquiteto",
  "Mestre de Obras",
  "Dono",
  "Outros",
] as const;

export type Cargo = typeof CARGO_OPTIONS[number];

export interface Pessoa {
  codigoPessoa?: string;       // PE000000001
  codigoConstrutora: string;   // FK -> Construtoras.codigo
  codigoObraAtual?: string;    // FK opcional -> Obras.codigoObra
  nome: string;
  cargo: string;
  whatsapp?: string;
  email?: string;
  observacoes?: string;
  dataCadastro?: string;           // DD/MM/AAAA
  dataUltimaAtualizacao?: string;  // DD/MM/AAAA
}

function buildUrl(path: string = "") {
  const base = import.meta.env.VITE_SUPABASE_URL;
  return `${base}/functions/v1/pessoas${path}`;
}

async function request(method: string, path: string = "", body?: unknown) {
  const headers = await buildAuthHeaders();
  const res = await fetch(buildUrl(path), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.fallback) {
    throw new Error(data?.error || `Erro na operação (${res.status})`);
  }
  return data;
}

export async function listarPessoas(filtros?: { codigoConstrutora?: string; codigoObra?: string }): Promise<Pessoa[]> {
  const qs = new URLSearchParams();
  if (filtros?.codigoConstrutora) qs.set("codigoConstrutora", filtros.codigoConstrutora);
  if (filtros?.codigoObra) qs.set("codigoObra", filtros.codigoObra);
  const path = qs.toString() ? `?${qs.toString()}` : "";
  return request("GET", path);
}
export async function buscarPessoa(codigo: string): Promise<Pessoa> {
  return request("GET", `/${encodeURIComponent(codigo)}`);
}
export async function criarPessoa(p: Pessoa): Promise<Pessoa> {
  return request("POST", "", p);
}
export async function atualizarPessoa(codigo: string, p: Partial<Pessoa>): Promise<Pessoa> {
  return request("PUT", `/${encodeURIComponent(codigo)}`, p);
}
export async function excluirPessoa(codigo: string): Promise<void> {
  await request("DELETE", `/${encodeURIComponent(codigo)}`);
}

export interface AtividadePessoa {
  idAtividade?: string;
  codigoPessoa: string;
  tipoRegistro: "atividade" | "visita" | "reuniao";
  data: string;                 // DD/MM/AAAA
  horario?: string;
  tipoContato?: string;
  status?: string;
  proximoContato?: string;
  comentario?: string;
  criarFollowUp?: string;
  idObra?: string;              // vínculo com Obra
  codigoConstrutora?: string;   // vínculo com Construtora
}

export async function listarAtividadesPessoa(codigoPessoa: string): Promise<AtividadePessoa[]> {
  return request("GET", `/atividades?codigo=${encodeURIComponent(codigoPessoa)}`);
}
export async function listarTodasAtividadesPessoas(): Promise<AtividadePessoa[]> {
  return request("GET", `/atividades`);
}
export async function criarAtividadePessoa(a: AtividadePessoa): Promise<AtividadePessoa> {
  return request("POST", `/atividades`, a);
}
export async function atualizarAtividadePessoa(id: string, patch: Partial<AtividadePessoa>): Promise<AtividadePessoa> {
  return request("PUT", `/atividades/${encodeURIComponent(id)}`, patch);
}
export async function excluirAtividadePessoa(id: string): Promise<void> {
  await request("DELETE", `/atividades/${encodeURIComponent(id)}`);
}
