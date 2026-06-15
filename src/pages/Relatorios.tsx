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
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";
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
  if (s.includes("fazendo")) return "Orçamento Enviado";
  if (s.includes("prospectar")) return "Prospectar";
  if (s.includes("prospecção") || s.includes("prospeccao")) return "Em Prospecção";
  if (s.includes("contato inicial")) return "Contato Inicial";
  if (s.includes("visita realizada")) return "Visita Realizada";
  if (s.includes("orçamento") || s.includes("orcamento")) return "Orçamento Enviado";
  if (s.includes("negociação") || s.includes("negociacao") || s.includes("negocia")) return "Negociação";
  if (s.includes("fechado") || s.includes("ganho")) return "Fechado";
  if (s.includes("perdido")) return "Perdido";
  return raw || "";
}

function temOrcamento(o: Obra): boolean {
  return Boolean(
    (o.dataOrcamentoEnviado || "").trim() ||
    (o.linkOrcamentoRhoden || "").trim() ||
    (o.linkOrcamentoPrado || "").trim() ||
    (o.linkOrcamentoImab || "").trim()
  );
}

function diasDesde(str: string): number | null {
  const d = parseDate(str);
  if (!d) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

// ─── Categorias do relatório ─────────────────────────────────────────────
type Categoria =
  | "em_andamento"           // Orçamento Enviado ou Negociação (aguardando decisão)
  | "perdida_pos_orcamento"  // Perdido + orçamento foi enviado
  | "perdida_prospeccao"     // Perdido + sem orçamento (caiu antes)
  | "fechada";               // Fechado (para taxa de conversão)

const CATEGORIA_LABEL: Record<Categoria, string> = {
  em_andamento: "Em andamento",
  perdida_pos_orcamento: "Perdida após orçamento",
  perdida_prospeccao: "Perdida na prospecção",
  fechada: "Fechada",
};

const CATEGORIA_BADGE: Record<Categoria, string> = {
  em_andamento: "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300",
  perdida_pos_orcamento: "bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300",
  perdida_prospeccao: "bg-slate-500/10 border-slate-500/30 text-slate-700 dark:text-slate-300",
  fechada: "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300",
};

function categorizar(o: Obra): Categoria | null {
  const stage = normalizeStage(o.statusProspeccao);
  if (stage === "Orçamento Enviado" || stage === "Negociação") return "em_andamento";
  if (stage === "Perdido") return temOrcamento(o) ? "perdida_pos_orcamento" : "perdida_prospeccao";
  if (stage === "Fechado") return "fechada";
  return null; // demais estágios não entram neste relatório
}

interface Linha {
  obra: Obra;
  categoria: Categoria;
  diasOrcamento: number | null;
}

export default function Relatorios() {
  const [obras, setObras] = useState<Obra[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  // Filtros
  const [fCategoria, setFCategoria] = useState<string>("todas");
  const [fConstrutora, setFConstrutora] = useState<string>("todas");
  const [fCidade, setFCidade] = useState<string>("todas");
  const [fDe, setFDe] = useState<string>("");
  const [fAte, setFAte] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await listarObras();
        if (!cancelled) setObras(data);
      } catch {
        if (!cancelled) setErro("Não foi possível carregar as obras. Tente novamente em instantes.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Todas as linhas categorizadas (antes dos filtros)
  const linhas = useMemo<Linha[]>(() => {
    return obras
      .map((obra) => {
        const categoria = categorizar(obra);
        if (!categoria) return null;
        return { obra, categoria, diasOrcamento: diasDesde(obra.dataOrcamentoEnviado) };
      })
      .filter((l): l is Linha => l !== null)
      .sort((a, b) => (b.diasOrcamento ?? -1) - (a.diasOrcamento ?? -1));
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
      if (fDe || fAte) {
        // Período sobre a data do orçamento; sem orçamento, usa a data de cadastro
        const ref = parseDate(l.obra.dataOrcamentoEnviado) ?? parseDate(l.obra.dataCadastro);
        if (!ref) return false;
        if (fDe && ref < new Date(fDe + "T00:00:00")) return false;
        if (fAte && ref > new Date(fAte + "T23:59:59")) return false;
      }
      return true;
    });
  }, [linhas, fCategoria, fConstrutora, fCidade, fDe, fAte]);

  // Resumo (sempre sobre o conjunto filtrado por construtora/cidade/período,
  // ignorando o filtro de categoria, para os cards continuarem comparáveis)
  const resumoBase = useMemo<Linha[]>(() => {
    return linhas.filter((l) => {
      if (fConstrutora !== "todas" && (l.obra.construtora || "").trim() !== fConstrutora) return false;
      if (fCidade !== "todas" && (l.obra.cidade || "").trim() !== fCidade) return false;
      if (fDe || fAte) {
        const ref = parseDate(l.obra.dataOrcamentoEnviado) ?? parseDate(l.obra.dataCadastro);
        if (!ref) return false;
        if (fDe && ref < new Date(fDe + "T00:00:00")) return false;
        if (fAte && ref > new Date(fAte + "T23:59:59")) return false;
      }
      return true;
    });
  }, [linhas, fConstrutora, fCidade, fDe, fAte]);

  const contagem = useMemo(() => {
    const c: Record<Categoria, number> = {
      em_andamento: 0, perdida_pos_orcamento: 0, perdida_prospeccao: 0, fechada: 0,
    };
    for (const l of resumoBase) c[l.categoria]++;
    return c;
  }, [resumoBase]);

  const paradas30d = useMemo(
    () => resumoBase.filter((l) => l.categoria === "em_andamento" && (l.diasOrcamento ?? 0) > 30).length,
    [resumoBase]
  );

  const decididas = contagem.fechada + contagem.perdida_pos_orcamento;
  const taxaConversao = decididas > 0 ? Math.round((contagem.fechada / decididas) * 100) : null;

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
      worksheet.mergeCells("A1:U1");
      const titleCell = worksheet.getCell("A1");
      titleCell.value = "RELATÓRIO DE ORÇAMENTOS E PROSPECÇÃO";
      titleCell.font = { name: "Segoe UI", size: 16, bold: true, color: { argb: "FFFFFF" } };
      titleCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "1E3A8A" } // Azul Escuro
      };
      titleCell.alignment = { horizontal: "center", vertical: "middle" };
      worksheet.getRow(1).height = 30;

      // SUBTÍTULO (Linha 2)
      worksheet.mergeCells("A2:U2");
      const subtitleCell = worksheet.getCell("A2");
      subtitleCell.value = "ASSISTENTE COMERCIAL GAL";
      subtitleCell.font = { name: "Segoe UI", size: 11, italic: true, color: { argb: "E5E7EB" } };
      subtitleCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "1E3A8A" }
      };
      subtitleCell.alignment = { horizontal: "center", vertical: "middle" };
      worksheet.getRow(2).height = 20;

      // 2. METADADOS E FILTROS (Linha 4)
      const dataGeracao = new Date().toLocaleString("pt-BR");
      const deFormat = fDe ? parseDate(fDe)?.toLocaleDateString("pt-BR") : "";
      const ateFormat = fAte ? parseDate(fAte)?.toLocaleDateString("pt-BR") : "";
      const periodoTexto = (deFormat || ateFormat) ? ` | Período: ${deFormat || "Início"} até ${ateFormat || "Fim"}` : "";
      
      worksheet.mergeCells("A4:U4");
      const metaCell = worksheet.getCell("A4");
      metaCell.value = `Filtros aplicados - Categoria: ${fCategoria === "todas" ? "Todas" : CATEGORIA_LABEL[fCategoria as Categoria]} | Construtora: ${fConstrutora === "todas" ? "Todas" : fConstrutora} | Cidade: ${fCidade === "todas" ? "Todas" : fCidade}${periodoTexto}   (Gerado em: ${dataGeracao})`;
      metaCell.font = { name: "Segoe UI", size: 9, italic: true, color: { argb: "4B5563" } };
      metaCell.alignment = { horizontal: "left", vertical: "middle" };
      worksheet.getRow(4).height = 18;

      // 3. CARDS DE KPI (Linhas 6 a 8)
      // Card 1: Em Andamento (B6:D8)
      worksheet.mergeCells("B6:D6");
      worksheet.getCell("B6").value = "Orçamentos em Andamento";
      worksheet.getCell("B6").font = { name: "Segoe UI", size: 9, bold: true, color: { argb: "374151" } };
      worksheet.getCell("B6").alignment = { horizontal: "center" };
      
      worksheet.mergeCells("B7:D7");
      worksheet.getCell("B7").value = contagem.em_andamento;
      worksheet.getCell("B7").font = { name: "Segoe UI", size: 16, bold: true, color: { argb: "D97706" } }; // Amber
      worksheet.getCell("B7").alignment = { horizontal: "center" };

      worksheet.mergeCells("B8:D8");
      worksheet.getCell("B8").value = paradas30d > 0 ? `${paradas30d} sem resp. há +30d` : "Nenhum atrasado";
      worksheet.getCell("B8").font = { name: "Segoe UI", size: 8, italic: true, color: { argb: "B45309" } };
      worksheet.getCell("B8").alignment = { horizontal: "center" };

      // Card 2: Perdidas após Orçamento (F6:H8)
      worksheet.mergeCells("F6:H6");
      worksheet.getCell("F6").value = "Perdidas Pós-Orçamento";
      worksheet.getCell("F6").font = { name: "Segoe UI", size: 9, bold: true, color: { argb: "374151" } };
      worksheet.getCell("F6").alignment = { horizontal: "center" };
      
      worksheet.mergeCells("F7:H7");
      worksheet.getCell("F7").value = contagem.perdida_pos_orcamento;
      worksheet.getCell("F7").font = { name: "Segoe UI", size: 16, bold: true, color: { argb: "DC2626" } }; // Vermelho
      worksheet.getCell("F7").alignment = { horizontal: "center" };

      worksheet.mergeCells("F8:H8");
      worksheet.getCell("F8").value = "—";
      worksheet.getCell("F8").font = { name: "Segoe UI", size: 8, italic: true, color: { argb: "6B7280" } };
      worksheet.getCell("F8").alignment = { horizontal: "center" };

      // Card 3: Perdidas na Prospecção (J6:L8)
      worksheet.mergeCells("J6:L6");
      worksheet.getCell("J6").value = "Perdidas na Prospecção";
      worksheet.getCell("J6").font = { name: "Segoe UI", size: 9, bold: true, color: { argb: "374151" } };
      worksheet.getCell("J6").alignment = { horizontal: "center" };
      
      worksheet.mergeCells("J7:L7");
      worksheet.getCell("J7").value = contagem.perdida_prospeccao;
      worksheet.getCell("J7").font = { name: "Segoe UI", size: 16, bold: true, color: { argb: "4B5563" } }; // Cinza
      worksheet.getCell("J7").alignment = { horizontal: "center" };

      worksheet.mergeCells("J8:L8");
      worksheet.getCell("J8").value = "—";
      worksheet.getCell("J8").font = { name: "Segoe UI", size: 8, italic: true, color: { argb: "6B7280" } };
      worksheet.getCell("J8").alignment = { horizontal: "center" };

      // Card 4: Fechadas (N6:P8)
      worksheet.mergeCells("N6:P6");
      worksheet.getCell("N6").value = "Fechadas (Ganhas)";
      worksheet.getCell("N6").font = { name: "Segoe UI", size: 9, bold: true, color: { argb: "374151" } };
      worksheet.getCell("N6").alignment = { horizontal: "center" };
      
      worksheet.mergeCells("N7:P7");
      worksheet.getCell("N7").value = contagem.fechada;
      worksheet.getCell("N7").font = { name: "Segoe UI", size: 16, bold: true, color: { argb: "059669" } }; // Esmeralda
      worksheet.getCell("N7").alignment = { horizontal: "center" };

      worksheet.mergeCells("N8:P8");
      worksheet.getCell("N8").value = taxaConversao != null ? `${taxaConversao}% conversão pós-orç.` : "Sem dados de taxa";
      worksheet.getCell("N8").font = { name: "Segoe UI", size: 8, italic: true, color: { argb: "047857" } };
      worksheet.getCell("N8").alignment = { horizontal: "center" };

      // Estilizar blocos de KPI (Fundo e Bordas)
      const kpiCols = [
        { start: 'B', end: 'D' },
        { start: 'F', end: 'H' },
        { start: 'J', end: 'L' },
        { start: 'N', end: 'P' }
      ];
      kpiCols.forEach(({ start, end }) => {
        const startIdx = start.charCodeAt(0) - 64;
        const endIdx = end.charCodeAt(0) - 64;
        for (let r = 6; r <= 8; r++) {
          for (let c = startIdx; c <= endIdx; c++) {
            const cell = worksheet.getCell(r, c);
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "F3F4F6" }
            };
            cell.border = {
              top: r === 6 ? { style: 'medium', color: { argb: 'D1D5DB' } } : undefined,
              bottom: r === 8 ? { style: 'medium', color: { argb: 'D1D5DB' } } : undefined,
              left: c === startIdx ? { style: 'medium', color: { argb: 'D1D5DB' } } : undefined,
              right: c === endIdx ? { style: 'medium', color: { argb: 'D1D5DB' } } : undefined,
            };
          }
        }
      });
      worksheet.getRow(6).height = 18;
      worksheet.getRow(7).height = 24;
      worksheet.getRow(8).height = 16;

      // 4. TABELA DE DADOS - CABEÇALHOS (Linha 10)
      const headers = [
        "Código/ID", "Obra", "Construtora", "Cidade", "Categoria", "Status original",
        "Classificação", "Produto", "Estágio Obra", "Data orçamento enviado", "Dias desde envio",
        "Próximo contato", "Responsável", "Telefone", "E-mail", "Concorrentes",
        "Orçamento Rhoden", "Orçamento Prado", "Orçamento Imab", "Observação", "Prospecção IA"
      ];
      
      const headerRowNumber = 10;
      const headerRow = worksheet.getRow(headerRowNumber);
      headerRow.values = headers;
      headerRow.height = 26;
      
      headers.forEach((_, index) => {
        const cell = headerRow.getCell(index + 1);
        cell.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FFFFFF" } };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "2563EB" } // Azul Médio
        };
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        cell.border = thinBorder;
      });

      // 5. ADICIONAR LINHAS DE DADOS (Linha 11+)
      let currentRowIdx = 11;
      
      filtradas.forEach((l) => {
        const row = worksheet.getRow(currentRowIdx);
        
        // Obter links limpos (pegar a primeira url se for separada por vírgula)
        const getCleanUrl = (rawUrl?: string) => {
          if (!rawUrl) return "";
          return rawUrl.split(",")[0].trim();
        };

        const valRhoden = getCleanUrl(l.obra.linkOrcamentoRhoden);
        const valPrado = getCleanUrl(l.obra.linkOrcamentoPrado);
        const valImab = getCleanUrl(l.obra.linkOrcamentoImab);

        // Preencher valores brutos
        row.getCell(1).value = l.obra.codigoObra || l.obra.id || "";
        row.getCell(2).value = l.obra.nome || "Sem nome";
        row.getCell(3).value = l.obra.construtora || "";
        row.getCell(4).value = l.obra.cidade || "";
        row.getCell(5).value = CATEGORIA_LABEL[l.categoria];
        row.getCell(6).value = l.obra.statusProspeccao || "";
        row.getCell(7).value = l.obra.classificacao || "";
        row.getCell(8).value = l.obra.produtoOferecido || "";
        row.getCell(9).value = l.obra.estagioObra || "";
        row.getCell(10).value = l.obra.dataOrcamentoEnviado || "";
        row.getCell(11).value = l.diasOrcamento != null ? `${l.diasOrcamento} dias` : "—";
        row.getCell(12).value = l.obra.proximoContato || "";
        row.getCell(13).value = l.obra.responsavel || "";
        row.getCell(14).value = l.obra.telefone || "";
        row.getCell(15).value = l.obra.email || "";
        row.getCell(16).value = l.obra.concorrentes || "";
        
        // Tratar links como hiperlinks se existirem
        if (valRhoden) {
          row.getCell(17).value = { text: "Rhoden PDF", hyperlink: valRhoden };
        } else {
          row.getCell(17).value = "—";
        }

        if (valPrado) {
          row.getCell(18).value = { text: "Prado PDF", hyperlink: valPrado };
        } else {
          row.getCell(18).value = "—";
        }

        if (valImab) {
          row.getCell(19).value = { text: "Imab PDF", hyperlink: valImab };
        } else {
          row.getCell(19).value = "—";
        }

        row.getCell(20).value = l.obra.observacoes || "";
        row.getCell(21).value = l.obra.prospeccaoIA || "";

        // Estilizar a linha (Zebra e Bordas)
        const isZebra = currentRowIdx % 2 === 0;
        const rowBg = isZebra ? "F9FAFB" : "FFFFFF";

        headers.forEach((_, colIndex) => {
          const cell = row.getCell(colIndex + 1);
          cell.border = thinBorder;
          cell.font = { name: "Segoe UI", size: 9, color: { argb: "1F2937" } };
          
          if (!cell.fill || cell.fill.type !== "pattern") {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: rowBg }
            };
          }

          // Alinhamento inteligente
          const alignCenterCols = [1, 5, 7, 8, 9, 10, 11, 12, 14, 17, 18, 19];
          const alignLeftCols = [2, 3, 4, 6, 13, 15, 16, 20, 21];

          cell.alignment = {
            horizontal: alignCenterCols.includes(colIndex + 1) ? "center" : "left",
            vertical: "middle",
            wrapText: [20, 21].includes(colIndex + 1) // wrap text para obs e IA
          };

          // Estilizar links especificamente
          if ([17, 18, 19].includes(colIndex + 1) && cell.value && typeof cell.value === "object" && "hyperlink" in cell.value) {
            cell.font = {
              name: "Segoe UI",
              size: 9,
              color: { argb: "2563EB" },
              underline: true
            };
          }
        });

        row.height = 22;
        currentRowIdx++;
      });

      // 6. AUTO-AJUSTE DAS COLUNAS (com margem de segurança)
      worksheet.columns.forEach((column, index) => {
        let maxLen = 0;
        // Cabeçalho
        const headerVal = column.values ? column.values[headerRowNumber] : null;
        if (headerVal) maxLen = Math.max(maxLen, String(headerVal).length);

        // Percorrer células da coluna na tabela de dados
        for (let r = headerRowNumber + 1; r < currentRowIdx; r++) {
          const cell = worksheet.getCell(r, index + 1);
          if (cell.value) {
            if (typeof cell.value === "object" && "text" in cell.value) {
              maxLen = Math.max(maxLen, String((cell.value as any).text).length);
            } else {
              maxLen = Math.max(maxLen, String(cell.value).length);
            }
          }
        }

        // Definir larguras razoáveis e limites de max/min para evitar colunas gigantescas
        let finalWidth = maxLen + 3;
        if (index + 1 === 1) finalWidth = Math.max(finalWidth, 15); // ID
        if ([2, 3].includes(index + 1)) finalWidth = Math.min(Math.max(finalWidth, 20), 40); // Obra, Construtora
        if ([20, 21].includes(index + 1)) finalWidth = 40; // Obs, IA
        
        column.width = finalWidth;
      });

      // 7. GERAR ARQUIVO E SALVAR
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      saveAs(blob, `relatorio-orcamentos-${new Date().toISOString().slice(0, 10)}.xlsx`);
      
    } catch (err) {
      console.error("Erro ao exportar excel:", err);
    }
  }

  const cards: { cat: Categoria; titulo: string; icone: JSX.Element; destaque?: string }[] = [
    { cat: "em_andamento", titulo: "Orçamentos em andamento", icone: <Send className="h-5 w-5 text-amber-500" />, destaque: paradas30d > 0 ? `${paradas30d} sem resposta há +30 dias` : undefined },
    { cat: "perdida_pos_orcamento", titulo: "Perdidas após orçamento", icone: <TrendingDown className="h-5 w-5 text-rose-500" /> },
    { cat: "perdida_prospeccao", titulo: "Perdidas na prospecção", icone: <Clock className="h-5 w-5 text-slate-500" /> },
    { cat: "fechada", titulo: "Fechadas", icone: <Trophy className="h-5 w-5 text-emerald-500" />, destaque: taxaConversao != null ? `${taxaConversao}% de conversão pós-orçamento` : undefined },
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
            Orçamentos em andamento e obras perdidas — antes ou depois do orçamento
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
          <label className="text-xs text-muted-foreground">Construtora</label>
          <Select value={fConstrutora} onValueChange={setFConstrutora}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              {construtoras.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
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
          <label className="text-xs text-muted-foreground">De (data do orçamento)</label>
          <Input type="date" value={fDe} onChange={(e) => setFDe(e.target.value)} className="w-[160px]" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Até</label>
          <Input type="date" value={fAte} onChange={(e) => setFAte(e.target.value)} className="w-[160px]" />
        </div>
        {(fCategoria !== "todas" || fConstrutora !== "todas" || fCidade !== "todas" || fDe || fAte) && (
          <Button variant="ghost" size="sm" onClick={() => { setFCategoria("todas"); setFConstrutora("todas"); setFCidade("todas"); setFDe(""); setFAte(""); }}>
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
                <th className="px-4 py-3 font-medium">Dias</th>
                <th className="px-4 py-3 font-medium">Concorrentes</th>
                <th className="px-4 py-3 font-medium">Próx. contato</th>
                <th className="px-4 py-3 font-medium">PDFs</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((l) => {
                const atrasada = l.categoria === "em_andamento" && (l.diasOrcamento ?? 0) > 30;
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
                    <td className={`px-4 py-3 ${atrasada ? "text-rose-600 dark:text-rose-400 font-semibold" : ""}`}>
                      {l.diasOrcamento != null ? `${l.diasOrcamento}d` : "—"}
                    </td>
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
