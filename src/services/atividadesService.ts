import { supabase } from "@/integrations/supabase/client";
import { buildAuthHeaders } from "@/lib/authFetch";

export interface Atividade {
  idAtividade?: string;
  idObra: string;
  dataAtividade: string;   // DD/MM/AAAA
  tipoContato: string;     // ligação | whatsapp | email | visita
  status: string;
  proximoContato: string;  // DD/MM/AAAA (opcional)
  comentario: string;
}

function buildUrl(opts: { id?: string; qs?: string } = {}) {
  const base = import.meta.env.VITE_SUPABASE_URL;
  let url = `${base}/functions/v1/atividades`;
  if (opts.id) url += `/${encodeURIComponent(opts.id)}`;
  if (opts.qs) url += `?${opts.qs}`;
  return url;
}

function buildHeaders() {
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  return {
    Authorization: `Bearer ${key}`,
    apikey: key,
    "Content-Type": "application/json",
  } as Record<string, string>;
}

async function request(method: string, body?: unknown, opts: { id?: string; qs?: string } = {}) {
  const res = await fetch(buildUrl(opts), {
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

export async function listarAtividadesPorObra(idObra: string): Promise<Atividade[]> {
  return request("GET", undefined, { qs: `idObra=${encodeURIComponent(idObra)}` });
}

export async function listarTodasAtividades(): Promise<Atividade[]> {
  return request("GET");
}

export async function criarAtividade(atividade: Atividade): Promise<Atividade> {
  return request("POST", atividade);
}

export async function atualizarAtividade(
  idAtividade: string,
  patch: Partial<Atividade>,
): Promise<Atividade> {
  return request("PUT", patch, { id: idAtividade });
}

export async function excluirAtividade(idAtividade: string): Promise<void> {
  await request("DELETE", undefined, { id: idAtividade });
}
