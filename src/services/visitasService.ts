// Serviço de Visitas/Reuniões — armazenado localmente (localStorage)
// Estrutura simples para acompanhamento de agenda de visitas/reuniões.

export type TipoEvento = "visita" | "reuniao";

export interface Visita {
  id: string;
  idObra: string;
  nomeObra: string;
  construtora: string;
  comprador: string;
  tipo: TipoEvento;
  data: string;   // YYYY-MM-DD
  horario: string; // HH:MM
  observacao?: string;
  criadoEm: string; // ISO
}

const KEY = "visitas-reunioes-v1";

function read(): Visita[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function write(items: Visita[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
}

export function listarVisitas(): Visita[] {
  return read().sort((a, b) => {
    const da = `${a.data} ${a.horario}`;
    const db = `${b.data} ${b.horario}`;
    return da.localeCompare(db);
  });
}

export function criarVisita(v: Omit<Visita, "id" | "criadoEm">): Visita {
  const novo: Visita = {
    ...v,
    id: crypto.randomUUID(),
    criadoEm: new Date().toISOString(),
  };
  const all = read();
  all.push(novo);
  write(all);
  return novo;
}

export function excluirVisita(id: string) {
  write(read().filter((v) => v.id !== id));
}

export function atualizarVisita(id: string, patch: Partial<Visita>) {
  const all = read();
  const idx = all.findIndex((v) => v.id === id);
  if (idx >= 0) {
    all[idx] = { ...all[idx], ...patch };
    write(all);
  }
}
