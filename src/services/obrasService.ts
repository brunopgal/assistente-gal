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

const API_BASE = "/api/obras";

export async function criarObra(obra: Obra): Promise<Obra> {
  const res = await fetch(API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(obra),
  });
  if (!res.ok) throw new Error("Erro ao criar obra");
  return res.json();
}

export async function atualizarObra(id: string, obra: Obra): Promise<Obra> {
  const res = await fetch(`${API_BASE}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(obra),
  });
  if (!res.ok) throw new Error("Erro ao atualizar obra");
  return res.json();
}

export async function buscarObra(id: string): Promise<Obra> {
  const res = await fetch(`${API_BASE}/${id}`);
  if (!res.ok) throw new Error("Erro ao buscar obra");
  return res.json();
}
