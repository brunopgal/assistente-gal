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

  function exportarCSV() {
    const header = [
      "Obra", "Construtora", "Cidade", "Categoria", "Status original",
      "Data orçamento enviado", "Dias desde envio", "Concorrentes", "Próximo contato",
    ];
    const escape = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = filtradas.map((l) => [
      l.obra.nome, l.obra.construtora, l.obra.cidade, CATEGORIA_LABEL[l.categoria],
      l.obra.statusProspeccao, l.obra.dataOrcamentoEnviado,
      l.diasOrcamento != null ? String(l.diasOrcamento) : "", l.obra.concorrentes, l.obra.proximoContato,
    ].map(escape).join(";"));
    const csv = "\uFEFF" + [header.map(escape).join(";"), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-orcamentos-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
        <Button variant="outline" size="sm" onClick={exportarCSV} disabled={loading || filtradas.length === 0}>
          <Download className="h-4 w-4 mr-2" />
          Exportar CSV
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
