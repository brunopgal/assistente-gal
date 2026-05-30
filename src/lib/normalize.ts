// Normalização para buscas e comparações: remove acentos, caixa e espaços extras.
// Use sempre que comparar strings vindas do usuário ou da planilha — assim
// maiúsculas/minúsculas, acentos e chapéus não fazem diferença.
export function normalizeText(s: unknown): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}
