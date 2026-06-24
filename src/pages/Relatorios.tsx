import { useEffect, useMemo, useState } from "react";
import { listarObras, type Obra } from "@/services/obrasService";
import { Loader2, FileBarChart, Download, ExternalLink, TrendingDown, Clock, Send, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link, useLocation } from "react-router-dom";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

// ─── Helpers (mesmos critérios do Dashboard) ───────────────────────────
function parseDate(str: string): Date | null {
  if (!str) return null;
  const parts = str.split("/");
  if (parts.length === 3) {
    const d = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
    if (!isNaN(d.getTime())) return d;
  }
  const iso = new Date(str);
  if (!isNaN(iso.getTime())) return iso;
  return null;
}

function normalizeStage(raw: string): string {
  const s = (raw || "").trim().toLowerCase();
  if (s === "contato inicial") return "Em Prospecção";
  if (s === "visita realizada") return "Lead Quente";
  if (s === "encerrado") return "Perdido";
  
  if (s.includes("prospectar")) return "Prospectar";
  if (s.includes("prospecção") || s.includes("prospeccao")) return "Em Prospecção";
  if (s.includes("lead") || s.includes("quente")) return "Lead Quente";
  if (s.includes("fazendo")) return "Fazendo Orçamento";
  if (s.includes("enviado") || s.includes("orçamento enviado") || s.includes("orcamento enviado")) return "Orçamento Enviado";
  if (s.includes("negociação") || s.includes("negociacao") || s.includes("negocia")) return "Negociação";
  if (s.includes("fechado") || s.includes("ganho")) return "Fechado";
  if (s.includes("perdido")) return "Perdido";
  return raw || "";
}

// ─── Categorias do relatório ─────────────────────────────────────────────
type Categoria =
  | "Orçamento Enviado"
  | "Negociação"
  | "Fechado"
  | "Perdido";

const CATEGORIA_LABEL: Record<Categoria, string> = {
  "Orçamento Enviado": "Orçamento Enviado",
  "Negociação": "Negociação",
  "Fechado": "Fechado",
  "Perdido": "Perdido",
};

const CATEGORIA_BADGE: Record<Categoria, string> = {
  "Orçamento Enviado": "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300",
  "Negociação": "bg-orange-500/10 border-orange-500/30 text-orange-700 dark:text-orange-300",
  "Fechado": "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300",
  "Perdido": "bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300",
};

function categorizar(o: Obra): Categoria | null {
  const stage = normalizeStage(o.statusProspeccao);
  if (stage === "Orçamento Enviado" || stage === "Negociação" || stage === "Fechado" || stage === "Perdido") {
    return stage as Categoria;
  }
  return null;
}

interface Linha {
  obra: Obra;
  categoria: Categoria;
}

export default function Relatorios() {
  const [obras, setObras] = useState<Obra[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  // Filtros
  const [fCategoria, setFCategoria] = useState<string>("todas");
  const [fConstrutora, setFConstrutora] = useState<string>("todas");
  const [fCidade, setFCidade] = useState<string>("todas");
  const [fProduto, setFProduto] = useState<string>("todos");

  const location = useLocation();

  useEffect(() => {
    let cancelled = false;
    const carregar = async () => {
      setLoading(true);
      try {
        const data = await listarObras();
        if (!cancelled) setObras(data);
      } catch {
        if (!cancelled) setErro("Não foi possível carregar as obras. Tente novamente em instantes.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    carregar();
    return () => { cancelled = true; };
  }, [location.pathname]);

  // Todas as linhas categorizadas (antes dos filtros)
  const linhas = useMemo<Linha[]>(() => {
    return obras
      .map((obra) => {
        const categoria = categorizar(obra);
        if (!categoria) return null;
        return { obra, categoria };
      })
      .filter((l): l is Linha => l !== null)
      .sort((a, b) => {
        const aDate = parseDate(a.obra.dataOrcamentoEnviado || a.obra.dataCadastro || "")?.getTime() || 0;
        const bDate = parseDate(b.obra.dataOrcamentoEnviado || b.obra.dataCadastro || "")?.getTime() || 0;
        return bDate - aDate;
      });
  }, [obras]);

  const construtoras = useMemo(
    () => Array.from(new Set(linhas.map((l) => (l.obra.construtora || "").trim()).filter(Boolean))).sort(),
    [linhas]
  );
  const cidades = useMemo(
    () => Array.from(new Set(linhas.map((l) => (l.obra.cidade || "").trim()).filter(Boolean))).sort(),
    [linhas]
  );

  // Aplica filtros
  const filtradas = useMemo<Linha[]>(() => {
    return linhas.filter((l) => {
      if (fCategoria !== "todas" && l.categoria !== fCategoria) return false;
      if (fConstrutora !== "todas" && (l.obra.construtora || "").trim() !== fConstrutora) return false;
      if (fCidade !== "todas" && (l.obra.cidade || "").trim() !== fCidade) return false;
      if (fProduto !== "todos") {
        const prodUpper = fProduto.toUpperCase();
        const obraProds = (l.obra.produtoOferecido || "")
          .split(",")
          .map((p) => p.trim().toUpperCase());
        if (!obraProds.includes(prodUpper)) return false;
      }
      return true;
    });
  }, [linhas, fCategoria, fConstrutora, fCidade, fProduto]);

  // Resumo (sempre sobre o conjunto filtrado por construtora/cidade/produto,
  // ignorando o filtro de categoria, para os cards continuarem comparáveis)
  const resumoBase = useMemo<Linha[]>(() => {
    return linhas.filter((l) => {
      if (fConstrutora !== "todas" && (l.obra.construtora || "").trim() !== fConstrutora) return false;
      if (fCidade !== "todas" && (l.obra.cidade || "").trim() !== fCidade) return false;
      if (fProduto !== "todos") {
        const prodUpper = fProduto.toUpperCase();
        const obraProds = (l.obra.produtoOferecido || "")
          .split(",")
          .map((p) => p.trim().toUpperCase());
        if (!obraProds.includes(prodUpper)) return false;
      }
      return true;
    });
  }, [linhas, fConstrutora, fCidade, fProduto]);

  const contagem = useMemo(() => {
    const c: Record<Categoria, number> = {
      "Orçamento Enviado": 0, "Negociação": 0, "Fechado": 0, "Perdido": 0,
    };
    for (const l of resumoBase) c[l.categoria]++;
    return c;
  }, [resumoBase]);

  const totalFechadoPerdido = contagem["Fechado"] + contagem["Perdido"];
  const taxaConversao = totalFechadoPerdido > 0 ? Math.round((contagem["Fechado"] / totalFechadoPerdido) * 100) : null;

  async function exportarExcel() {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Orçamentos");
      
      // Mostrar linhas de grade
      worksheet.views = [{ showGridLines: true }];

      // Estilos reutilizáveis
      const thinBorder: Partial<ExcelJS.Borders> = {
        top: { style: 'thin', color: { argb: 'D1D5DB' } },
        left: { style: 'thin', color: { argb: 'D1D5DB' } },
        bottom: { style: 'thin', color: { argb: 'D1D5DB' } },
        right: { style: 'thin', color: { argb: 'D1D5DB' } }
      };

      // 1. TÍTULO PRINCIPAL (Linha 1)
      worksheet.mergeCells("A1:H1");
      const titleCell = worksheet.getCell("A1");
      titleCell.value = "RELATÓRIO DE ORÇAMENTOS";
      titleCell.font = { name: "Segoe UI", size: 16, bold: true, color: { argb: "FFFFFF" } };
      titleCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "1E3A8A" } // Azul Escuro
      };
      titleCell.alignment = { horizontal: "center", vertical: "middle" };
      worksheet.getRow(1).height = 30;

      // SUBTÍTULO / FILTROS (Linha 2)
      worksheet.mergeCells("A2:H2");
      const subtitleCell = worksheet.getCell("A2");
      subtitleCell.value = `Filtros aplicados - Categoria: ${fCategoria === "todas" ? "Todas" : CATEGORIA_LABEL[fCategoria as Categoria]} | Construtora: ${fConstrutora === "todas" ? "Todas" : fConstrutora} | Cidade: ${fCidade === "todas" ? "Todas" : fCidade} | Produto: ${fProduto === "todos" ? "Todos" : fProduto}`;
      subtitleCell.font = { name: "Segoe UI", size: 10, italic: true, color: { argb: "FFFFFF" } };
      subtitleCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "2563EB" } // Azul Médio
      };
      subtitleCell.alignment = { horizontal: "center", vertical: "middle" };
      worksheet.getRow(2).height = 20;

      // 2. TABELA DE DADOS - CABEÇALHOS (Linha 4)
      const headers = [
        "Obra", "Construtora", "Cidade", "Categoria", "Orçamento enviado", "Concorrentes", "Próx. contato", "PDFs"
      ];
      
      const headerRowNumber = 4;
      const headerRow = worksheet.getRow(headerRowNumber);
      headerRow.values = headers;
      headerRow.height = 26;
      
      headers.forEach((_, index) => {
        const cell = headerRow.getCell(index + 1);
        cell.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FFFFFF" } };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "1F2937" } // Cinza Escuro
        };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = thinBorder;
      });

      // 3. ADICIONAR LINHAS DE DADOS (Linha 5+)
      let currentRowIdx = 5;
      
      filtradas.forEach((l) => {
        const row = worksheet.getRow(currentRowIdx);

        row.getCell(1).value = l.obra.nome || "Sem nome";
        row.getCell(2).value = l.obra.construtora || "—";
        row.getCell(3).value = l.obra.cidade || "—";
        row.getCell(4).value = CATEGORIA_LABEL[l.categoria];
        row.getCell(5).value = l.obra.dataOrcamentoEnviado || "";
        row.getCell(6).value = l.obra.concorrentes || "—";
        row.getCell(7).value = l.obra.proximoContato || "—";

        const pdfParts: string[] = [];
        if (l.obra.linkOrcamentoRhoden) pdfParts.push("Rhoden");
        if (l.obra.linkOrcamentoPrado) pdfParts.push("Prado");
        if (l.obra.linkOrcamentoImab) pdfParts.push("Imab");
        row.getCell(8).value = pdfParts.join(", ") || "—";

        // Estilizar a linha (Zebra e Bordas)
        const isZebra = currentRowIdx % 2 === 0;
        const rowBg = isZebra ? "F9FAFB" : "FFFFFF";

        headers.forEach((_, colIndex) => {
          const cell = row.getCell(colIndex + 1);
          cell.border = thinBorder;
          cell.font = { name: "Segoe UI", size: 9, color: { argb: "1F2937" } };
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: rowBg }
          };

          // Alinhamento inteligente
          const alignCenterCols = [3, 4, 5, 7, 8]; // Cidade, Categoria, Orçamento enviado, Próx. contato, PDFs
          cell.alignment = {
            horizontal: alignCenterCols.includes(colIndex + 1) ? "center" : "left",
            vertical: "middle"
          };
        });

        row.height = 22;
        currentRowIdx++;
      });

      // 4. AUTO-AJUSTE DAS COLUNAS
      worksheet.columns.forEach((column, index) => {
        let maxLen = 0;
        const headerVal = column.values ? column.values[headerRowNumber] : null;
        if (headerVal) maxLen = Math.max(maxLen, String(headerVal).length);

        for (let r = headerRowNumber + 1; r < currentRowIdx; r++) {
          const cell = worksheet.getCell(r, index + 1);
          if (cell.value) {
            maxLen = Math.max(maxLen, String(cell.value).length);
          }
        }

        let finalWidth = maxLen + 4;
        // Limites mínimos e máximos razoáveis
        if ([1, 2].includes(index + 1)) finalWidth = Math.min(Math.max(finalWidth, 18), 35); // Obra, Construtora
        if (index + 1 === 6) finalWidth = Math.min(Math.max(finalWidth, 15), 35); // Concorrentes
        column.width = finalWidth;
      });

      // 5. GERAR ARQUIVO E SALVAR
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      saveAs(blob, `relatorio-orcamentos-${new Date().toISOString().slice(0, 10)}.xlsx`);
      
    } catch (err) {
      console.error("Erro ao exportar excel:", err);
    }
  }

  const cards: { cat: Categoria; titulo: string; icone: JSX.Element; destaque?: string }[] = [
    { cat: "Orçamento Enviado", titulo: "Orçamento Enviado", icone: <Send className="h-5 w-5 text-amber-500" /> },
    { cat: "Negociação", titulo: "Negociação", icone: <Clock className="h-5 w-5 text-orange-500" /> },
    { cat: "Fechado", titulo: "Fechado", icone: <Trophy className="h-5 w-5 text-emerald-500" />, destaque: taxaConversao != null ? `${taxaConversao}% de conversão` : undefined },
    { cat: "Perdido", titulo: "Perdido", icone: <TrendingDown className="h-5 w-5 text-rose-500" /> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            <FileBarChart className="h-6 w-6 text-primary" />
            Relatório de Orçamentos
          </h1>
          <p className="text-muted-foreground mt-1">
            Orçamentos em andamento e obras perdidas
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={exportarExcel} disabled={loading || filtradas.length === 0}>
          <Download className="h-4 w-4 mr-2" />
          Exportar Excel
        </Button>
      </div>

      {/* Cards de resumo (clicáveis para filtrar) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(({ cat, titulo, icone, destaque }) => (
          <button
            key={cat}
            onClick={() => setFCategoria(fCategoria === cat ? "todas" : cat)}
            className={`text-left rounded-lg border p-4 transition-colors hover:bg-muted/50 ${fCategoria === cat ? "border-primary ring-1 ring-primary" : "border-border"}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{titulo}</span>
              {icone}
            </div>
            <p className="text-3xl font-bold mt-2">{contagem[cat]}</p>
            {destaque && <p className="text-xs text-muted-foreground mt-1">{destaque}</p>}
          </button>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Categoria</label>
          <Select value={fCategoria} onValueChange={setFCategoria}>
            <SelectTrigger className="w-[210px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as categorias</SelectItem>
              {(Object.keys(CATEGORIA_LABEL) as Categoria[]).map((c) => (
                <SelectItem key={c} value={c}>{CATEGORIA_LABEL[c]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Produto</label>
          <Select value={fProduto} onValueChange={setFProduto}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="PRADO">Prado</SelectItem>
              <SelectItem value="ROHDEN">Rohden</SelectItem>
              <SelectItem value="IMAB">Imab</SelectItem>
              <SelectItem value="OUTROS">Outros</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Cidade</label>
          <Select value={fCidade} onValueChange={setFCidade}>
            <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              {cidades.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Construtora</label>
          <Select value={fConstrutora} onValueChange={setFConstrutora}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              {construtoras.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {(fCategoria !== "todas" || fConstrutora !== "todas" || fCidade !== "todas" || fProduto !== "todos") && (
          <Button variant="ghost" size="sm" onClick={() => { setFCategoria("todas"); setFConstrutora("todas"); setFCidade("todas"); setFProduto("todos"); }}>
            Limpar filtros
          </Button>
        )}
      </div>

      {/* Tabela */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : erro ? (
        <p className="text-sm text-destructive py-8 text-center">{erro}</p>
      ) : filtradas.length === 0 ? (
        <p className="text-sm text-muted-foreground py-12 text-center">
          Nenhuma obra encontrada com os filtros atuais.
        </p>
      ) : (
        <div className="rounded-lg border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium">Obra</th>
                <th className="px-4 py-3 font-medium">Construtora</th>
                <th className="px-4 py-3 font-medium">Cidade</th>
                <th className="px-4 py-3 font-medium">Categoria</th>
                <th className="px-4 py-3 font-medium">Orçamento enviado</th>
                <th className="px-4 py-3 font-medium">Concorrentes</th>
                <th className="px-4 py-3 font-medium">Próx. contato</th>
                <th className="px-4 py-3 font-medium">PDFs</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((l) => {
                return (
                  <tr key={l.obra.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <Link to={`/atividades/${l.obra.id}`} className="font-medium text-primary hover:underline">
                        {l.obra.nome || "Sem nome"}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{l.obra.construtora || "—"}</td>
                    <td className="px-4 py-3">{l.obra.cidade || "—"}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={CATEGORIA_BADGE[l.categoria]}>
                        {CATEGORIA_LABEL[l.categoria]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">{l.obra.dataOrcamentoEnviado || "—"}</td>
                    <td className="px-4 py-3 max-w-[180px] truncate" title={l.obra.concorrentes}>
                      {l.obra.concorrentes || "—"}
                    </td>
                    <td className="px-4 py-3">{l.obra.proximoContato || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {[
                          { label: "R", url: l.obra.linkOrcamentoRhoden },
                          { label: "P", url: l.obra.linkOrcamentoPrado },
                          { label: "I", url: l.obra.linkOrcamentoImab },
                        ].filter((x) => (x.url || "").trim()).map((x) => (
                          <a
                            key={x.label}
                            href={(x.url || "").split(",")[0].trim()}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={`Orçamento ${x.label === "R" ? "Rhoden" : x.label === "P" ? "Prado" : "Imab"}`}
                            className="inline-flex items-center gap-0.5 text-xs text-primary hover:underline"
                          >
                            {x.label}<ExternalLink className="h-3 w-3" />
                          </a>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && filtradas.length > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          {filtradas.length} obra(s) no relatório • Clique nos cards para filtrar por categoria
        </p>
      )}
    </div>
  );
}
