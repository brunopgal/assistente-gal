import * as XLSX from "xlsx";

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Exporta um array de objetos como .xlsx. Inclui TODAS as chaves
 * presentes em qualquer item (união) para preservar todas as colunas.
 */
export function exportarParaExcel<T extends Record<string, unknown>>(
  rows: T[],
  baseName: string,
  sheetName = "Dados",
): void {
  const safeRows = rows.length ? rows : [{ aviso: "Sem registros" } as unknown as T];
  // União de chaves preservando ordem de aparição
  const headers: string[] = [];
  const seen = new Set<string>();
  safeRows.forEach((r) => {
    Object.keys(r || {}).forEach((k) => {
      if (!seen.has(k)) {
        seen.add(k);
        headers.push(k);
      }
    });
  });
  const normalized = safeRows.map((r) => {
    const o: Record<string, unknown> = {};
    headers.forEach((h) => {
      const v = (r as Record<string, unknown>)[h];
      o[h] = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : v;
    });
    return o;
  });
  const ws = XLSX.utils.json_to_sheet(normalized, { header: headers });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31) || "Dados");
  XLSX.writeFile(wb, `${baseName}_${todayStr()}.xlsx`);
}
