import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listarObras, type Obra } from "@/services/obrasService";
import { listarConstrutoras, type Construtora } from "@/services/construtorasService";
import { listarPessoas, type Pessoa } from "@/services/pessoasService";
import { listarTodasAtividades, type Atividade } from "@/services/atividadesService";
import { listarTodasAtividadesConstrutoras, type AtividadeConstrutora } from "@/services/construtorasService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building2,
  Building,
  Users,
  ListChecks,
  Loader2,
  LayoutDashboard,
  AlertTriangle,
  CalendarClock,
  CalendarCheck,
  CalendarX2,
  MapPin,
  Package,
  TrendingDown,
  ExternalLink,
  MessageSquare,
  Filter,
} from "lucide-react";

// ─── Estágios do funil comercial ───────────────────────────────────────
const FUNNEL_STAGES = [
  "Prospectar",
  "Em Prospecção",
  "Contato Inicial",
  "Visita Realizada",
  "Orçamento Enviado",
  "Negociação",
  "Fechado",
  "Perdido",
] as const;

type FunnelStage = (typeof FUNNEL_STAGES)[number];

const FUNNEL_COLORS: Record<FunnelStage, string> = {
  "Prospectar":         "from-slate-400 to-slate-500",
  "Em Prospecção":      "from-sky-400 to-sky-500",
  "Contato Inicial":    "from-cyan-400 to-cyan-500",
  "Visita Realizada":   "from-teal-400 to-teal-500",
  "Orçamento Enviado":  "from-amber-400 to-amber-500",
  "Negociação":         "from-orange-400 to-orange-500",
  "Fechado":            "from-emerald-400 to-emerald-500",
  "Perdido":            "from-rose-400 to-rose-500",
};

const FUNNEL_BG: Record<FunnelStage, string> = {
  "Prospectar":         "bg-slate-500/10 border-slate-500/30 text-slate-700 dark:text-slate-300",
  "Em Prospecção":      "bg-sky-500/10 border-sky-500/30 text-sky-700 dark:text-sky-300",
  "Contato Inicial":    "bg-cyan-500/10 border-cyan-500/30 text-cyan-700 dark:text-cyan-300",
  "Visita Realizada":   "bg-teal-500/10 border-teal-500/30 text-teal-700 dark:text-teal-300",
  "Orçamento Enviado":  "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300",
  "Negociação":         "bg-orange-500/10 border-orange-500/30 text-orange-700 dark:text-orange-300",
  "Fechado":            "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300",
  "Perdido":            "bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300",
};

// ─── Helpers ────────────────────────────────────────────────────────────
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

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dateToCompare(str: string): string {
  const d = parseDate(str);
  if (!d) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDaysStr(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function normalizeStage(raw: string): string {
  const s = (raw || "").trim().toLowerCase();
  // Map legacy / alternate values to canonical stages
  if (s.includes("fazendo")) return "Orçamento Enviado";
  for (const stage of FUNNEL_STAGES) {
    if (stage.toLowerCase() === s) return stage;
  }
  // Partial matching for common variants
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

// ─── Follow-up category type ────────────────────────────────────────────
type FollowUpCategory = "atrasados" | "hoje" | "proximos7" | "semFollowUp";

// ─── Dashboard Component ────────────────────────────────────────────────
export default function Dashboard() {
  const [obras, setObras] = useState<Obra[]>([]);
  const [construtoras, setConstrutoras] = useState<Construtora[]>([]);
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [atividadesConstrutoras, setAtividadesConstrutoras] = useState<AtividadeConstrutora[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstagio, setFiltroEstagio] = useState<string>("__all__");
  const [selectedFollowUp, setSelectedFollowUp] = useState<FollowUpCategory | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [obrasData, ctsData, pesData, atvsData, atvsCtsData] = await Promise.all([
          listarObras().catch(() => [] as Obra[]),
          listarConstrutoras().catch(() => [] as Construtora[]),
          listarPessoas().catch(() => [] as Pessoa[]),
          listarTodasAtividades().catch(() => [] as Atividade[]),
          listarTodasAtividadesConstrutoras().catch(() => [] as AtividadeConstrutora[]),
        ]);
        setObras(obrasData);
        setConstrutoras(ctsData);
        setPessoas(pesData);
        setAtividades(atvsData);
        setAtividadesConstrutoras(atvsCtsData);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ─── Filtered obras based on global stage filter ─────────────────────
  const obrasFiltradas = useMemo(() => {
    if (filtroEstagio === "__all__") return obras;
    return obras.filter((o) => normalizeStage(o.statusProspeccao) === filtroEstagio);
  }, [obras, filtroEstagio]);

  // ─── KPI counts ──────────────────────────────────────────────────────
  const totalConstrutoras = useMemo(() => {
    if (filtroEstagio === "__all__") return construtoras.length;
    const ctNames = new Set(obrasFiltradas.map((o) => (o.construtora || "").trim().toLowerCase()).filter(Boolean));
    return ctNames.size;
  }, [construtoras, obrasFiltradas, filtroEstagio]);

  const totalObras = obrasFiltradas.length;

  const totalPessoas = useMemo(() => {
    if (filtroEstagio === "__all__") return pessoas.length;
    const ctCodes = new Set(obrasFiltradas.map((o) => o.codigoConstrutora).filter(Boolean));
    return pessoas.filter((p) => ctCodes.has(p.codigoConstrutora)).length;
  }, [pessoas, obrasFiltradas, filtroEstagio]);

  const totalAtividades = useMemo(() => {
    if (filtroEstagio === "__all__") return atividades.length + atividadesConstrutoras.length;
    const obraIds = new Set(obrasFiltradas.map((o) => o.id || o.codigoObra).filter(Boolean));
    const filteredAtvs = atividades.filter((a) => obraIds.has(a.idObra));
    return filteredAtvs.length + atividadesConstrutoras.length;
  }, [atividades, atividadesConstrutoras, obrasFiltradas, filtroEstagio]);

  // ─── Funnel data ─────────────────────────────────────────────────────
  const funnelData = useMemo(() => {
    const counts: Record<string, number> = {};
    FUNNEL_STAGES.forEach((s) => (counts[s] = 0));
    obras.forEach((o) => {
      const stage = normalizeStage(o.statusProspeccao);
      if (stage in counts) counts[stage]++;
    });
    const total = obras.length || 1;
    return FUNNEL_STAGES.map((stage) => ({
      stage,
      count: counts[stage],
      pct: Math.round((counts[stage] / total) * 100),
    }));
  }, [obras]);

  const maxFunnelCount = useMemo(() => Math.max(...funnelData.map((d) => d.count), 1), [funnelData]);

  // ─── Follow-up categorization ────────────────────────────────────────
  const today = todayStr();
  const in7Days = addDaysStr(7);

  const followUpData = useMemo(() => {
    const activeStatuses = ["Fechado", "Perdido"];
    const atrasados: Obra[] = [];
    const hojeList: Obra[] = [];
    const proximos7: Obra[] = [];
    const semFollowUp: Obra[] = [];

    obrasFiltradas.forEach((o) => {
      const stage = normalizeStage(o.statusProspeccao);
      const fc = dateToCompare(o.proximoContato);
      if (!fc) {
        if (!activeStatuses.includes(stage)) {
          semFollowUp.push(o);
        }
        return;
      }
      if (fc < today) atrasados.push(o);
      else if (fc === today) hojeList.push(o);
      else if (fc <= in7Days) proximos7.push(o);
    });

    return { atrasados, hoje: hojeList, proximos7, semFollowUp };
  }, [obrasFiltradas, today, in7Days]);

  // ─── Rankings ────────────────────────────────────────────────────────
  const rankCidades = useMemo(() => {
    const map = new Map<string, number>();
    obrasFiltradas.forEach((o) => {
      const c = (o.cidade || "").trim();
      if (c) map.set(c, (map.get(c) || 0) + 1);
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [obrasFiltradas]);

  const rankConstrutoras = useMemo(() => {
    const map = new Map<string, number>();
    obrasFiltradas.forEach((o) => {
      const c = (o.construtora || "").trim();
      if (c) map.set(c, (map.get(c) || 0) + 1);
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [obrasFiltradas]);

  const rankProdutos = useMemo(() => {
    const map = new Map<string, number>();
    obrasFiltradas.forEach((o) => {
      (o.produtoOferecido || "")
        .split(",")
        .map((p) => p.trim().toUpperCase())
        .filter((p) => ["IMAB", "RHODEN", "PRADO"].includes(p))
        .forEach((p) => map.set(p, (map.get(p) || 0) + 1));
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
  }, [obrasFiltradas]);

  // ─── Follow-up detail list ───────────────────────────────────────────
  const followUpDetailList = useMemo(() => {
    if (!selectedFollowUp) return [];
    return followUpData[selectedFollowUp];
  }, [selectedFollowUp, followUpData]);

  const followUpDetailTitle: Record<FollowUpCategory, string> = {
    atrasados: "Follow-ups Atrasados",
    hoje: "Follow-ups de Hoje",
    proximos7: "Próximos 7 Dias",
    semFollowUp: "Sem Follow-up Definido",
  };

  function handleFunnelClick(stage: FunnelStage) {
    setFiltroEstagio((prev) => (prev === stage ? "__all__" : stage));
  }

  function toggleFollowUpCategory(cat: FollowUpCategory) {
    setSelectedFollowUp((prev) => (prev === cat ? null : cat));
  }

  // ─── Render ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header + Global Filter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1
            className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            <LayoutDashboard className="h-7 w-7 text-primary" />
            Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Visão geral do pipeline comercial e indicadores de prospecção
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filtroEstagio} onValueChange={(v) => { setFiltroEstagio(v); setSelectedFollowUp(null); }}>
            <SelectTrigger className="h-9 w-[220px]">
              <SelectValue placeholder="Filtrar por estágio" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos os estágios</SelectItem>
              {FUNNEL_STAGES.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {filtroEstagio !== "__all__" && (
            <Button variant="ghost" size="sm" onClick={() => setFiltroEstagio("__all__")}>
              Limpar
            </Button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          icon={Building}
          label="Construtoras"
          value={totalConstrutoras}
          color="text-sky-500"
          bgColor="bg-sky-500/10"
          href="/construtoras"
        />
        <KPICard
          icon={Building2}
          label="Obras"
          value={totalObras}
          color="text-amber-500"
          bgColor="bg-amber-500/10"
          href="/obras"
        />
        <KPICard
          icon={Users}
          label="Pessoas"
          value={totalPessoas}
          color="text-emerald-500"
          bgColor="bg-emerald-500/10"
          href="/pessoas"
        />
        <KPICard
          icon={ListChecks}
          label="Atividades"
          value={totalAtividades}
          color="text-purple-500"
          bgColor="bg-purple-500/10"
        />
      </div>

      {/* Commercial Funnel */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-primary" />
            Funil Comercial
            <span className="text-xs font-normal text-muted-foreground ml-auto">
              {obras.length} obras no total
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {funnelData.map(({ stage, count, pct }) => {
              const isActive = filtroEstagio === stage;
              return (
                <button
                  key={stage}
                  onClick={() => handleFunnelClick(stage as FunnelStage)}
                  className={`group relative flex flex-col items-center rounded-xl border p-3 transition-all duration-200 cursor-pointer
                    ${isActive
                      ? `${FUNNEL_BG[stage as FunnelStage]} ring-2 ring-primary/40 scale-[1.03] shadow-lg`
                      : "border-border/50 bg-card hover:border-primary/30 hover:shadow-md hover:scale-[1.02]"
                    }`}
                >
                  {/* Colored bar at top */}
                  <div
                    className={`w-full h-1.5 rounded-full bg-gradient-to-r ${FUNNEL_COLORS[stage as FunnelStage]} mb-2.5 transition-all`}
                    style={{ opacity: count > 0 ? 0.4 + (count / maxFunnelCount) * 0.6 : 0.15 }}
                  />
                  <span className="text-2xl font-bold text-foreground">{count}</span>
                  <span className="text-[11px] text-muted-foreground text-center leading-tight mt-1">
                    {stage}
                  </span>
                  <span className="text-[10px] font-medium text-muted-foreground/70 mt-0.5">
                    {pct}%
                  </span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Follow-up Cards */}
      <div className="space-y-4">
        <h2
          className="text-lg font-semibold text-foreground flex items-center gap-2"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          <CalendarClock className="h-5 w-5 text-primary" />
          Acompanhamento de Follow-ups
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <FollowUpCard
            icon={AlertTriangle}
            label="Atrasados"
            count={followUpData.atrasados.length}
            color="text-rose-500"
            bgColor="bg-rose-500/10"
            borderColor="border-rose-500/20"
            active={selectedFollowUp === "atrasados"}
            onClick={() => toggleFollowUpCategory("atrasados")}
          />
          <FollowUpCard
            icon={CalendarClock}
            label="Hoje"
            count={followUpData.hoje.length}
            color="text-amber-500"
            bgColor="bg-amber-500/10"
            borderColor="border-amber-500/20"
            active={selectedFollowUp === "hoje"}
            onClick={() => toggleFollowUpCategory("hoje")}
          />
          <FollowUpCard
            icon={CalendarCheck}
            label="Próximos 7 dias"
            count={followUpData.proximos7.length}
            color="text-sky-500"
            bgColor="bg-sky-500/10"
            borderColor="border-sky-500/20"
            active={selectedFollowUp === "proximos7"}
            onClick={() => toggleFollowUpCategory("proximos7")}
          />
          <FollowUpCard
            icon={CalendarX2}
            label="Sem follow-up"
            count={followUpData.semFollowUp.length}
            color="text-slate-500"
            bgColor="bg-slate-500/10"
            borderColor="border-slate-500/20"
            active={selectedFollowUp === "semFollowUp"}
            onClick={() => toggleFollowUpCategory("semFollowUp")}
          />
        </div>

        {/* Follow-up detail list */}
        {selectedFollowUp && (
          <Card className="animate-in fade-in-0 slide-in-from-top-2 duration-300">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {followUpDetailTitle[selectedFollowUp]}
                <Badge variant="secondary" className="ml-2 text-xs">{followUpDetailList.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {followUpDetailList.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhuma obra nesta categoria.
                </p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {followUpDetailList.map((obra) => {
                    const phone = (obra.telefone || "").replace(/\D/g, "");
                    const whatsappUrl = phone ? `https://wa.me/55${phone}` : "";
                    return (
                      <div
                        key={obra.id || obra.codigoObra}
                        className="border border-border/50 rounded-lg p-3 bg-card hover:border-primary/30 transition-colors space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h4 className="font-semibold text-sm truncate">{obra.nome || "Sem nome"}</h4>
                            <p className="text-xs text-muted-foreground truncate">{obra.construtora || "—"}</p>
                          </div>
                          <Badge variant="outline" className="text-[10px] shrink-0">
                            {normalizeStage(obra.statusProspeccao) || "—"}
                          </Badge>
                        </div>
                        {obra.proximoContato && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <CalendarClock className="h-3 w-3" />
                            Follow-up: <span className="text-foreground font-medium">{obra.proximoContato}</span>
                          </p>
                        )}
                        {obra.cidade && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <MapPin className="h-3 w-3" />
                            {obra.cidade}
                          </p>
                        )}
                        <div className="flex items-center gap-1.5 flex-wrap pt-1">
                          {whatsappUrl && (
                            <Button variant="outline" size="sm" asChild className="h-7 text-[11px] px-2">
                              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                                <MessageSquare className="h-3 w-3 mr-1" />
                                WhatsApp
                              </a>
                            </Button>
                          )}
                          <Button variant="outline" size="sm" asChild className="h-7 text-[11px] px-2">
                            <Link to={`/atividades/${encodeURIComponent(obra.id || obra.codigoObra || "")}`}>
                              <ExternalLink className="h-3 w-3 mr-1" />
                              Detalhes
                            </Link>
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Rankings */}
      <div className="grid gap-6 md:grid-cols-3">
        <RankingCard
          icon={MapPin}
          title="Top Cidades"
          data={rankCidades}
          emptyText="Sem dados de cidades"
          color="text-teal-500"
        />
        <RankingCard
          icon={Building}
          title="Top Construtoras"
          data={rankConstrutoras}
          emptyText="Sem dados de construtoras"
          color="text-sky-500"
        />
        <RankingCard
          icon={Package}
          title="Produtos"
          data={rankProdutos}
          emptyText="Sem dados de produtos"
          color="text-orange-500"
          productColors
        />
      </div>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────

function KPICard({
  icon: Icon,
  label,
  value,
  color,
  bgColor,
  href,
}: {
  icon: typeof Building;
  label: string;
  value: number;
  color: string;
  bgColor: string;
  href?: string;
}) {
  const content = (
    <Card className="group overflow-hidden hover:shadow-lg hover:border-primary/30 transition-all duration-200 cursor-pointer">
      <CardContent className="p-5 flex items-center gap-4">
        <div className={`rounded-xl p-3 ${bgColor} transition-transform group-hover:scale-110`}>
          <Icon className={`h-6 w-6 ${color}`} />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">{value.toLocaleString("pt-BR")}</p>
          <p className="text-xs text-muted-foreground font-medium">{label}</p>
        </div>
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link to={href}>{content}</Link>;
  }
  return content;
}

function FollowUpCard({
  icon: Icon,
  label,
  count,
  color,
  bgColor,
  borderColor,
  active,
  onClick,
}: {
  icon: typeof AlertTriangle;
  label: string;
  count: number;
  color: string;
  bgColor: string;
  borderColor: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="text-left w-full">
      <Card
        className={`overflow-hidden transition-all duration-200 cursor-pointer
          ${active
            ? `${borderColor} ring-2 ring-primary/40 shadow-lg scale-[1.02]`
            : "hover:shadow-md hover:border-primary/30 hover:scale-[1.01]"
          }`}
      >
        <CardContent className="p-4 flex items-center gap-3">
          <div className={`rounded-lg p-2.5 ${bgColor}`}>
            <Icon className={`h-5 w-5 ${color}`} />
          </div>
          <div>
            <p className="text-xl font-bold text-foreground">{count}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        </CardContent>
      </Card>
    </button>
  );
}

function RankingCard({
  icon: Icon,
  title,
  data,
  emptyText,
  color,
  productColors,
}: {
  icon: typeof MapPin;
  title: string;
  data: [string, number][];
  emptyText: string;
  color: string;
  productColors?: boolean;
}) {
  const maxVal = data.length > 0 ? data[0][1] : 1;

  function getProductColor(name: string) {
    const n = name.toUpperCase();
    if (n.includes("PRADO")) return "text-orange-500";
    if (n.includes("RHODEN")) return "text-blue-500";
    if (n.includes("IMAB")) return "text-foreground";
    return "";
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Icon className={`h-4 w-4 ${color}`} />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">{emptyText}</p>
        ) : (
          <div className="space-y-3">
            {data.map(([name, count], i) => (
              <div key={name} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-medium truncate ${productColors ? getProductColor(name) : ""}`}>
                    <span className="text-xs text-muted-foreground mr-1.5">{i + 1}.</span>
                    {name}
                  </span>
                  <span className="text-sm font-bold text-foreground ml-2">{count}</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r from-primary/60 to-primary transition-all duration-500`}
                    style={{ width: `${(count / maxVal) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
