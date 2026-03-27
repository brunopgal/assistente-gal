import { supabase } from "@/integrations/supabase/client";

export interface Obra {
  id?: string;
  nome: string;
  construtora: string;
  cidade: string;
  status: string;
  responsavel: string;
  dataContato: string;
  observacoes: string;
}

async function invokeObras(method: string, body?: Obra, id?: string) {
  const path = id ? `obras/${id}` : 'obras';
  
  // Build the URL manually for the edge function
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  
  const url = `${supabaseUrl}/functions/v1/${path}`;
  
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${supabaseKey}`,
    'apikey': supabaseKey,
    'Content-Type': 'application/json',
  };

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Erro na operação (${res.status})`);
  }

  return res.json();
}

export async function criarObra(obra: Obra): Promise<Obra> {
  return invokeObras('POST', obra);
}

export async function atualizarObra(id: string, obra: Obra): Promise<Obra> {
  return invokeObras('PUT', obra, id);
}

export async function buscarObra(id: string): Promise<Obra> {
  return invokeObras('GET', undefined, id);
}

export async function listarObras(): Promise<Obra[]> {
  return invokeObras('GET');
}
