import { useEffect, useState, useMemo } from "react";
import { listarObras, limparFollowUp, atualizarFollowUp, type Obra } from "@/services/obrasService";
import { listarTodasAtividades, type Atividade } from "@/services/atividadesService";
import {
  listarConstrutoras,
  listarTodasAtividadesConstrutoras,
  atualizarAtividadeConstrutora,
  type Construtora,
  type AtividadeConstrutora,
} from "@/services/construtorasService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MessageSquare, MapPin, ExternalLink, CheckCircle, Loader2, AlertTriangle, CalendarClock, CalendarCheck, Pencil, Building, Search, CalendarDays } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function parseDate(str: string): Date | null {
  if (!str) return null;
  // Try dd/mm/yyyy
  const parts = str.split("/");
  if (parts.length === 3) {
    const d = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
    if (!isNaN(d.getTime())) return d;
  }
  // Try yyyy-mm-dd
  const iso = new Date(str);
  if (!isNaN(iso.getTime())) return iso;
  return null;
}

function formatDate(str: string): string {
  const d = parseDate(str);
  if (!d) return str;
  return d.toLocaleDateString("pt-BR");
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

function getNext7DaysStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function calculateDaysOverdue(targetDateStr: string, todayStr: string): number {
  const targetDate = new Date(targetDateStr);
  const today = new Date(todayStr);
  
  // Set time to midnight for accurate day difference
  targetDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  
  const diffTime = today.getTime() - targetDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 3600 * 24));
  return diffDays > 0 ? diffDays : 0;
}

interface FollowUpObra extends Obra {
  followUpDate: string; // comparable yyyy-mm-dd
  ultimaAtividade?: Atividade | null;
}

function statusColor(status: string) {
  const s = status.toLowerCase();
  if (s.includes("ganho") || s.includes("fechado")) return "default";
  if (s.includes("perdido")) return "destructive";
  if (s.includes("negociação") || s.includes("negociacao")) return "secondary";
  return "outline";
}

function FollowUpCard({ obra, onDone, onReschedule, loading, rescheduling, todayStr }: { obra: FollowUpObra; onDone: () => void; onReschedule: (newDate: string) => Promise<void>; loading: boolean; rescheduling: boolean; todayStr: string }) {
  const [editOpen, setEditOpen] = useState(false);
  const [newDate, setNewDate] = useState<string>(dateToCompare(obra.proximoContato) || todayStr);
  const phone = obra.telefone?.replace(/\D/g, "") || "";
  const whatsappUrl = phone ? `https://wa.me/55${phone}` : "";
  const loc = (obra.localizacao || "").trim();
  const isLocUrl = /^https?:\/\//i.test(loc);
  const mapsQuery = [obra.nome, loc, obra.cidade].filter(Boolean).join(", ");
  const mapsUrl = isLocUrl
    ? loc
    : mapsQuery
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`
      : "";

  const isOverdue = obra.followUpDate < todayStr;
  const daysOverdue = isOverdue ? calculateDaysOverdue(obra.followUpDate, todayStr) : 0;

  return (
    <Card className={`border-border/50 bg-card transition-colors ${isOverdue ? 'border-destructive/30 hover:border-destructive/60' : 'hover:border-primary/30'}`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 min-w-0">
            <h3 className="font-semibold text-foreground truncate">{obra.nome || "Sem nome"}</h3>
            <p className="text-sm text-muted-foreground truncate">{obra.construtora || "—"}</p>
          </div>
          <Badge variant={statusColor(obra.statusProspeccao)} className="shrink-0 text-[10px] uppercase">
            {obra.statusProspeccao || "—"}
          </Badge>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarClock className={`h-3.5 w-3.5 shrink-0 ${isOverdue ? 'text-destructive' : ''}`} />
            <span>Follow-up: <span className={`font-medium ${isOverdue ? 'text-destructive' : 'text-foreground'}`}>{formatDate(obra.proximoContato)}</span></span>
            <Popover open={editOpen} onOpenChange={setEditOpen}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 ml-auto" disabled={rescheduling}>
                  {rescheduling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pencil className="h-3.5 w-3.5" />}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-3 space-y-2" align="end">
                <p className="text-xs font-medium text-foreground">Reagendar follow-up</p>
                <Input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="h-9"
                />
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" size="sm" onClick={() => setEditOpen(false)}>Cancelar</Button>
                  <Button
                    size="sm"
                    onClick={async () => {
                      if (!newDate) return;
                      const [y, m, d] = newDate.split("-");
                      await onReschedule(`${d}/${m}/${y}`);
                      setEditOpen(false);
                    }}
                  >
                    Salvar
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
          {isOverdue && daysOverdue > 0 && (
            <span className="text-xs font-medium text-destructive ml-5">
              Atrasado há {daysOverdue} {daysOverdue === 1 ? 'dia' : 'dias'}
            </span>
          )}
        </div>

        {obra.ultimaAtividade && (obra.ultimaAtividade.comentario || obra.ultimaAtividade.status || obra.ultimaAtividade.tipoContato) && (
          <div className="text-sm bg-muted/50 rounded p-2 space-y-1">
            <div className="flex items-center justify-between gap-2 mb-1 border-b border-border/50 pb-1">
               <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Último Contato</span>
               {obra.ultimaAtividade.tipoContato && (
                 <Badge variant="outline" className="text-[10px] h-4 px-1.5 capitalize bg-background">
                   {obra.ultimaAtividade.tipoContato}
                 </Badge>
               )}
            </div>
            {obra.ultimaAtividade.comentario && (
              <p className="text-foreground/90 line-clamp-3 text-xs leading-relaxed">{obra.ultimaAtividade.comentario}</p>
            )}
            {obra.ultimaAtividade.status && (
              <div className="flex items-center gap-1.5 pt-1">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Status:</span>
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                  {obra.ultimaAtividade.status}
                </Badge>
              </div>
            )}
          </div>
        )}

        {!obra.ultimaAtividade?.comentario && obra.observacoes && (
          <p className="text-xs text-muted-foreground bg-muted/50 rounded p-2 line-clamp-2">
            {obra.observacoes}
          </p>
        )}

        <div className="flex items-center gap-2 flex-wrap pt-1">
          {whatsappUrl && (
            <Button variant="outline" size="sm" asChild className="h-8 text-xs px-2">
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                <MessageSquare className="h-3 w-3 mr-1" />
                WhatsApp
              </a>
            </Button>
          )}
          {mapsUrl && (
            <Button variant="outline" size="sm" asChild className="h-8 text-xs px-2">
              <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
                <MapPin className="h-3 w-3 mr-1" />
                Mapa
              </a>
            </Button>
          )}
          <Button variant="outline" size="sm" asChild className="h-8 text-xs px-2">
            <a href={`/atividades/${obra.id}`}>
              <ExternalLink className="h-3 w-3 mr-1" />
              Detalhes
            </a>
          </Button>
          <Button
            variant="default"
            size="sm"
            className="h-8 text-xs ml-auto"
            onClick={onDone}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5 mr-1" />}
            Feito
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function FollowUp() {
  const [obras, setObras] = useState<FollowUpObra[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);
  const { toast } = useToast();

  const [ctFollowUps, setCtFollowUps] = useState<Array<{ atv: AtividadeConstrutora; construtora: Construtora; followUpDate: string }>>([]);
  const [doneCtId, setDoneCtId] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<"Todos" | "Atrasados" | "Hoje" | "Esta semana">("Todos");

  const fetchData = async () => {
    setLoading(true);
    try {
      const all = await listarObras();
      const withFollowUp: FollowUpObra[] = all
        .filter((o) => o.proximoContato && parseDate(o.proximoContato))
        .map((o) => ({ ...o, followUpDate: dateToCompare(o.proximoContato), ultimaAtividade: null }))
        .sort((a, b) => a.followUpDate.localeCompare(b.followUpDate));
      setObras(withFollowUp);
      setLoading(false);

      // Carrega todas as atividades em uma única leitura e agrupa por obra.
      const todasAtividades = await listarTodasAtividades().catch(() => []);
      const ultimaPorObra = new Map<string, Atividade>();
      for (const atividade of todasAtividades) {
        const idObra = (atividade.idObra || "").trim();
        if (!idObra) continue;
        const atual = ultimaPorObra.get(idObra);
        if (!atual || dateToCompare(atividade.dataAtividade) > dateToCompare(atual.dataAtividade)) {
          ultimaPorObra.set(idObra, atividade);
        }
      }
      const results = withFollowUp.map((o) => ({ id: o.id!, ultima: ultimaPorObra.get(o.id!) || null }));
      setObras((prev) =>
        prev.map((o) => {
          const r = results.find((x) => x.id === o.id);
          return r ? { ...o, ultimaAtividade: r.ultima } : o;
        }),
      );

      // Construtoras: atividades marcadas com criarFollowUp = "sim" e proximoContato preenchido
      try {
        const [cts, atvsCt] = await Promise.all([
          listarConstrutoras(),
          listarTodasAtividadesConstrutoras(),
        ]);
        const ctMap = new Map(cts.map((c) => [(c.codigo || "").toUpperCase(), c]));
        const items = atvsCt
          .filter((a) =>
            (a.criarFollowUp || "").toLowerCase() === "sim" &&
            a.proximoContato && parseDate(a.proximoContato),
          )
          .map((a) => {
            const c = ctMap.get((a.codigoConstrutora || "").toUpperCase());
            return c ? { atv: a, construtora: c, followUpDate: dateToCompare(a.proximoContato || "") } : null;
          })
          .filter((x): x is { atv: AtividadeConstrutora; construtora: Construtora; followUpDate: string } => !!x)
          .sort((a, b) => a.followUpDate.localeCompare(b.followUpDate));
        setCtFollowUps(items);
      } catch (e) {
        console.warn("Erro ao carregar follow-ups de construtoras:", e);
      }
    } catch {
      toast({ title: "Erro ao carregar follow-ups", variant: "destructive" });
      setLoading(false);
    }
  };

  const handleDoneCt = async (atvId: string) => {
    setDoneCtId(atvId);
    try {
      await atualizarAtividadeConstrutora(atvId, { criarFollowUp: "" });
      setCtFollowUps((prev) => prev.filter((x) => x.atv.idAtividade !== atvId));
      toast({ title: "Follow-up concluído" });
    } catch {
      toast({ title: "Erro ao concluir", variant: "destructive" });
    } finally {
      setDoneCtId(null);
    }
  };


  useEffect(() => {
    fetchData();
    const onFocus = () => fetchData();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, []);

  const handleDone = async (obra: FollowUpObra) => {
    setMarkingId(obra.id!);
    try {
      await limparFollowUp(obra.id!);
      setObras((prev) => prev.filter((o) => o.id !== obra.id));
      toast({ title: `Follow-up de "${obra.nome}" marcado como feito` });
    } catch {
      toast({ title: "Erro ao atualizar", variant: "destructive" });
    } finally {
      setMarkingId(null);
    }
  };

  const handleReschedule = async (obra: FollowUpObra, newDateBR: string) => {
    setReschedulingId(obra.id!);
    try {
      await atualizarFollowUp(obra.id!, newDateBR);
      setObras((prev) =>
        prev
          .map((o) =>
            o.id === obra.id
              ? { ...o, proximoContato: newDateBR, followUpDate: dateToCompare(newDateBR) }
              : o,
          )
          .sort((a, b) => a.followUpDate.localeCompare(b.followUpDate)),
      );
      toast({ title: `Follow-up de "${obra.nome}" reagendado para ${newDateBR}` });
    } catch {
      toast({ title: "Erro ao reagendar", variant: "destructive" });
    } finally {
      setReschedulingId(null);
    }
  };

  const today = todayStr();
  const next7DaysStr = getNext7DaysStr();

  // Memos for summary cards
  const summary = useMemo(() => {
    let atrasados = 0;
    let hoje = 0;
    let proximos7 = 0;
    
    const allItems = [...obras.map(o => o.followUpDate), ...ctFollowUps.map(c => c.followUpDate)];
    
    allItems.forEach(date => {
      if (date < today) atrasados++;
      else if (date === today) hoje++;
      else if (date > today && date <= next7DaysStr) proximos7++;
    });

    return {
      atrasados,
      hoje,
      proximos7,
      total: allItems.length
    };
  }, [obras, ctFollowUps, today, next7DaysStr]);

  // Apply filters
  const filteredObras = useMemo(() => {
    return obras.filter(obra => {
      // Text search
      const term = searchTerm.toLowerCase();
      const matchesSearch = !term || 
        (obra.nome || "").toLowerCase().includes(term) || 
        (obra.construtora || "").toLowerCase().includes(term);
      
      if (!matchesSearch) return false;

      // Quick filter
      if (activeFilter === "Todos") return true;
      if (activeFilter === "Atrasados") return obra.followUpDate < today;
      if (activeFilter === "Hoje") return obra.followUpDate === today;
      if (activeFilter === "Esta semana") return obra.followUpDate > today && obra.followUpDate <= next7DaysStr;
      
      return true;
    });
  }, [obras, searchTerm, activeFilter, today, next7DaysStr]);

  const filteredCts = useMemo(() => {
    return ctFollowUps.filter(ct => {
      // Text search
      const term = searchTerm.toLowerCase();
      const matchesSearch = !term || 
        (ct.construtora.nome || "").toLowerCase().includes(term) ||
        (ct.construtora.codigo || "").toLowerCase().includes(term);
      
      if (!matchesSearch) return false;

      // Quick filter
      if (activeFilter === "Todos") return true;
      if (activeFilter === "Atrasados") return ct.followUpDate < today;
      if (activeFilter === "Hoje") return ct.followUpDate === today;
      if (activeFilter === "Esta semana") return ct.followUpDate > today && ct.followUpDate <= next7DaysStr;
      
      return true;
    });
  }, [ctFollowUps, searchTerm, activeFilter, today, next7DaysStr]);

  const atrasados = filteredObras.filter((o) => o.followUpDate < today);
  const hoje = filteredObras.filter((o) => o.followUpDate === today);
  const proximos = filteredObras.filter((o) => o.followUpDate > today);
  
  const ctsAtrasados = filteredCts.filter((c) => c.followUpDate < today);
  const ctsHoje = filteredCts.filter((c) => c.followUpDate === today);
  const ctsProximos = filteredCts.filter((c) => c.followUpDate > today);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const Section = ({ title, items, icon: Icon, color }: { title: string; items: FollowUpObra[]; icon: typeof AlertTriangle; color: string }) => {
    if (items.length === 0) return null;
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Icon className={`h-5 w-5 ${color}`} />
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <Badge variant="secondary" className="text-xs">{items.length}</Badge>
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {items.map((obra) => (
            <FollowUpCard
              key={obra.id}
              obra={obra}
              onDone={() => handleDone(obra)}
              onReschedule={(newDate) => handleReschedule(obra, newDate)}
              loading={markingId === obra.id}
              rescheduling={reschedulingId === obra.id}
              todayStr={today}
            />
          ))}
        </div>
      </div>
    );
  };
  
  const CtsSection = ({ title, items, icon: Icon, color }: { title: string; items: Array<{ atv: AtividadeConstrutora; construtora: Construtora; followUpDate: string }>; icon: typeof AlertTriangle; color: string }) => {
    if (items.length === 0) return null;
    return (
      <div className="space-y-3 mt-6">
        <div className="flex items-center gap-2">
          <Icon className={`h-5 w-5 ${color}`} />
          <h2 className="text-lg font-semibold text-foreground">{title} (Construtoras)</h2>
          <Badge variant="secondary" className="text-xs">{items.length}</Badge>
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {items.map(({ atv, construtora, followUpDate }) => {
            const isOverdue = followUpDate < today;
            const daysOverdue = isOverdue ? calculateDaysOverdue(followUpDate, today) : 0;
            
            return (
              <Card key={atv.idAtividade} className={`border-border/50 bg-card transition-colors ${isOverdue ? 'border-destructive/30 hover:border-destructive/60' : 'hover:border-primary/30'}`}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 space-y-1">
                      <h3 className="font-semibold text-foreground truncate">{construtora.nome}</h3>
                      <p className="text-xs text-muted-foreground truncate">{construtora.codigo}</p>
                    </div>
                    <Badge variant="outline" className="shrink-0 text-[10px] uppercase">Construtora</Badge>
                  </div>
                  
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CalendarClock className={`h-3.5 w-3.5 ${isOverdue ? 'text-destructive' : ''}`} />
                      <span>Follow-up: <span className={`font-medium ${isOverdue ? 'text-destructive' : 'text-foreground'}`}>{formatDate(atv.proximoContato || "")}</span></span>
                    </div>
                    {isOverdue && daysOverdue > 0 && (
                      <span className="text-xs font-medium text-destructive ml-5">
                        Atrasado há {daysOverdue} {daysOverdue === 1 ? 'dia' : 'dias'}
                      </span>
                    )}
                  </div>
                  
                  <div className="text-sm bg-muted/50 rounded p-2 space-y-1">
                    <div className="flex items-center justify-between gap-2 mb-1 border-b border-border/50 pb-1">
                       <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Último Contato</span>
                       {atv.tipoRegistro && (
                         <Badge variant="outline" className="text-[10px] h-4 px-1.5 capitalize bg-background">
                           {atv.tipoRegistro}
                         </Badge>
                       )}
                    </div>
                    {atv.comentario && (
                      <p className="text-foreground/90 line-clamp-3 text-xs leading-relaxed">{atv.comentario}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    <Button variant="outline" size="sm" asChild className="h-8 text-xs px-2">
                      <a href={`/construtoras/${construtora.id}`} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Detalhes
                      </a>
                    </Button>
                    <Button
                      size="sm"
                      className="h-8 text-xs ml-auto"
                      onClick={() => handleDoneCt(atv.idAtividade!)}
                      disabled={doneCtId === atv.idAtividade}
                    >
                      {doneCtId === atv.idAtividade ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5 mr-1" />}
                      Feito
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );
  };

  const isEmpty = obras.length === 0 && ctFollowUps.length === 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          Follow-up
        </h1>
        <p className="text-muted-foreground mt-1">Acompanhe os próximos contatos das suas obras e construtoras</p>
      </div>

      {!isEmpty && (
        <>
          {/* RESUMO CARDS */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-destructive/5 border-destructive/20 shadow-sm">
              <CardContent className="p-4 flex flex-col justify-center">
                <div className="flex items-center gap-2 text-destructive font-medium mb-1">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm">Atrasados</span>
                </div>
                <span className="text-2xl font-bold text-destructive">{summary.atrasados}</span>
              </CardContent>
            </Card>
            
            <Card className="bg-primary/5 border-primary/20 shadow-sm">
              <CardContent className="p-4 flex flex-col justify-center">
                <div className="flex items-center gap-2 text-primary font-medium mb-1">
                  <CalendarClock className="h-4 w-4" />
                  <span className="text-sm">Hoje</span>
                </div>
                <span className="text-2xl font-bold text-primary">{summary.hoje}</span>
              </CardContent>
            </Card>
            
            <Card className="bg-card shadow-sm">
              <CardContent className="p-4 flex flex-col justify-center">
                <div className="flex items-center gap-2 text-muted-foreground font-medium mb-1">
                  <CalendarCheck className="h-4 w-4" />
                  <span className="text-sm">Próximos 7 dias</span>
                </div>
                <span className="text-2xl font-bold">{summary.proximos7}</span>
              </CardContent>
            </Card>
            
            <Card className="bg-card shadow-sm">
              <CardContent className="p-4 flex flex-col justify-center">
                <div className="flex items-center gap-2 text-muted-foreground font-medium mb-1">
                  <CalendarDays className="h-4 w-4" />
                  <span className="text-sm">Total Pendente</span>
                </div>
                <span className="text-2xl font-bold">{summary.total}</span>
              </CardContent>
            </Card>
          </div>

          {/* FILTERS BAR */}
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-muted/30 p-3 rounded-lg border border-border/50">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar obra ou construtora..." 
                className="pl-9 h-10 w-full bg-background"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
              {(["Todos", "Atrasados", "Hoje", "Esta semana"] as const).map((filter) => (
                <Button
                  key={filter}
                  variant={activeFilter === filter ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveFilter(filter)}
                  className="whitespace-nowrap h-9"
                >
                  {filter}
                </Button>
              ))}
            </div>
          </div>
        </>
      )}

      {isEmpty ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <CalendarCheck className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">Nenhum follow-up pendente</p>
            <p className="text-sm text-muted-foreground/70 mt-1">Cadastre datas de follow-up nas obras para vê-las aqui</p>
          </CardContent>
        </Card>
      ) : filteredObras.length === 0 && filteredCts.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Search className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">Nenhum follow-up encontrado para os filtros atuais</p>
            <Button variant="link" onClick={() => { setSearchTerm(""); setActiveFilter("Todos"); }} className="mt-2">
              Limpar filtros
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* OBRAS */}
          <Section title="Atrasados" items={atrasados} icon={AlertTriangle} color="text-destructive" />
          <CtsSection title="Atrasados" items={ctsAtrasados} icon={AlertTriangle} color="text-destructive" />
          
          <Section title="Hoje" items={hoje} icon={CalendarClock} color="text-primary" />
          <CtsSection title="Hoje" items={ctsHoje} icon={CalendarClock} color="text-primary" />
          
          <Section title="Próximos" items={proximos} icon={CalendarCheck} color="text-muted-foreground" />
          <CtsSection title="Próximos" items={ctsProximos} icon={CalendarCheck} color="text-muted-foreground" />
        </>
      )}
    </div>
  );
}

