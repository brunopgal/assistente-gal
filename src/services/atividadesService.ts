import { supabase } from "@/integrations/supabase/client";

export interface Atividade {
  idAtividade?: string;
  idObra: string;
  dataAtividade: string;   // DD/MM/AAAA
  tipoContato: string;     // ligação | whatsapp | email | visita
  status: string;
  proximoContato: string;  // DD/MM/AAAA (opcional)
  comentario: string;
}

function buildUrl(qs?: string) {
  const base = import.meta.env.VITE_SUPABASE_URL;
  return qs
    ? `${base}/functions/v1/atividades?${qs}`
    : `${base}/functions/v1/atividades`;
}

function buildHeaders() {
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  return {
    Authorization: `Bearer ${key}`,
    apikey: key,
    "Content-Type": "application/json",
  } as Record<string, string>;
}

async function request(method: string, body?: unknown, qs?: string) {
  const res = await fetch(buildUrl(qs), {
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
  return request("GET", undefined, `idObra=${encodeURIComponent(idObra)}`);
}

export async function criarAtividade(atividade: Atividade): Promise<Atividade> {
  return request("POST", atividade);
}
