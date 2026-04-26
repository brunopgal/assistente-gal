import { useEffect, useState } from "react";
import { listarObras, limparFollowUp, atualizarFollowUp, type Obra } from "@/services/obrasService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MessageSquare, MapPin, ExternalLink, CheckCircle, Loader2, AlertTriangle, CalendarClock, CalendarCheck, Pencil } from "lucide-react";
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

interface FollowUpObra extends Obra {
  followUpDate: string; // comparable yyyy-mm-dd
}

function statusColor(status: string) {
  const s = status.toLowerCase();
  if (s.includes("ganho") || s.includes("fechado")) return "default";
  if (s.includes("perdido")) return "destructive";
  if (s.includes("negociação") || s.includes("negociacao")) return "secondary";
  return "outline";
}

function FollowUpCard({ obra, onDone, onReschedule, loading, rescheduling }: { obra: FollowUpObra; onDone: () => void; onReschedule: (newDate: string) => Promise<void>; loading: boolean; rescheduling: boolean }) {
  const [editOpen, setEditOpen] = useState(false);
  const [newDate, setNewDate] = useState<string>(dateToCompare(obra.proximoContato) || todayStr());
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

  return (
    <Card className="border-border/50 bg-card hover:border-primary/30 transition-colors">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 min-w-0">
            <h3 className="font-semibold text-foreground truncate">{obra.nome || "Sem nome"}</h3>
            <p className="text-sm text-muted-foreground truncate">{obra.construtora || "—"}</p>
          </div>
          <Badge variant={statusColor(obra.statusProspeccao)} className="shrink-0 text-xs">
            {obra.statusProspeccao || "—"}
          </Badge>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarClock className="h-3.5 w-3.5 shrink-0" />
          <span>Follow-up: <span className="text-foreground font-medium">{formatDate(obra.proximoContato)}</span></span>
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

        {obra.observacoes && (
          <p className="text-sm text-muted-foreground bg-muted/50 rounded p-2 line-clamp-2">
            {obra.observacoes}
          </p>
        )}

        <div className="flex items-center gap-2 flex-wrap pt-1">
          {whatsappUrl && (
            <Button variant="outline" size="sm" asChild className="h-8 text-xs">
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                <MessageSquare className="h-3.5 w-3.5 mr-1" />
                WhatsApp
              </a>
            </Button>
          )}
          {mapsUrl && (
            <Button variant="outline" size="sm" asChild className="h-8 text-xs">
              <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
                <MapPin className="h-3.5 w-3.5 mr-1" />
                Mapa
              </a>
            </Button>
          )}
          <Button variant="outline" size="sm" asChild className="h-8 text-xs">
            <a href={`/nova-obra?id=${obra.id}`}>
              <ExternalLink className="h-3.5 w-3.5 mr-1" />
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

  const fetchData = async () => {
    setLoading(true);
    try {
      const all = await listarObras();
      const today = todayStr();
      const withFollowUp = all
        .filter((o) => o.proximoContato && parseDate(o.proximoContato))
        .map((o) => ({ ...o, followUpDate: dateToCompare(o.proximoContato) }))
        .sort((a, b) => a.followUpDate.localeCompare(b.followUpDate));
      setObras(withFollowUp);
    } catch {
      toast({ title: "Erro ao carregar follow-ups", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

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
  const atrasados = obras.filter((o) => o.followUpDate < today);
  const hoje = obras.filter((o) => o.followUpDate === today);
  const proximos = obras.filter((o) => o.followUpDate > today);

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
              loading={markingId === obra.id}
            />
          ))}
        </div>
      </div>
    );
  };

  const isEmpty = obras.length === 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          Follow-up
        </h1>
        <p className="text-muted-foreground mt-1">Acompanhe os próximos contatos das suas obras</p>
      </div>

      {isEmpty ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <CalendarCheck className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">Nenhum follow-up pendente</p>
            <p className="text-sm text-muted-foreground/70 mt-1">Cadastre datas de follow-up nas obras para vê-las aqui</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Section title="Atrasados" items={atrasados} icon={AlertTriangle} color="text-destructive" />
          <Section title="Hoje" items={hoje} icon={CalendarClock} color="text-primary" />
          <Section title="Próximos" items={proximos} icon={CalendarCheck} color="text-muted-foreground" />
        </>
      )}
    </div>
  );
}
