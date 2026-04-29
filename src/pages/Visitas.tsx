import { useEffect, useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { listarObras, type Obra } from "@/services/obrasService";
import { listarVisitas, criarVisita, excluirVisita, type Visita, type TipoEvento } from "@/services/visitasService";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarClock, Plus, Trash2, ExternalLink, Loader2, Check, ChevronsUpDown, Building2, Clock, AlertTriangle, CalendarCheck, X, Filter } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

function formatDateBR(iso: string) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function Visitas() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filtroObra = searchParams.get("obra") || "";

  const [obras, setObras] = useState<Obra[]>([]);
  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [loadingObras, setLoadingObras] = useState(true);
  const [open, setOpen] = useState(false);
  const [obraPickerOpen, setObraPickerOpen] = useState(false);
  const { toast } = useToast();

  // form
  const [obraId, setObraId] = useState("");
  const [tipo, setTipo] = useState<TipoEvento>("visita");
  const [data, setData] = useState(todayISO());
  const [horario, setHorario] = useState("09:00");
  const [observacao, setObservacao] = useState("");

  useEffect(() => {
    setVisitas(listarVisitas());
    listarObras()
      .then((o) => setObras(o))
      .catch(() => toast({ title: "Erro ao carregar obras", variant: "destructive" }))
      .finally(() => setLoadingObras(false));
  }, []);

  // Pré-seleciona a obra no formulário quando vem da página Obras
  useEffect(() => {
    if (filtroObra && !obraId) setObraId(filtroObra);
  }, [filtroObra]);

  const obraFiltrada = useMemo(
    () => obras.find((o) => o.id === filtroObra || o.codigoObra === filtroObra),
    [obras, filtroObra],
  );

  const obraSelecionada = useMemo(() => obras.find((o) => o.id === obraId), [obras, obraId]);

  const reset = () => {
    setObraId("");
    setTipo("visita");
    setData(todayISO());
    setHorario("09:00");
    setObservacao("");
  };

  const handleCriar = () => {
    if (!obraSelecionada) {
      toast({ title: "Selecione uma obra", variant: "destructive" });
      return;
    }
    if (!data || !horario) {
      toast({ title: "Informe data e horário", variant: "destructive" });
      return;
    }
    criarVisita({
      idObra: obraSelecionada.id || "",
      nomeObra: obraSelecionada.nome || "",
      construtora: obraSelecionada.construtora || "",
      comprador: obraSelecionada.responsavel || "",
      tipo,
      data,
      horario,
      observacao: observacao.trim(),
    });
    setVisitas(listarVisitas());
    reset();
    setOpen(false);
    toast({ title: "Visita/Reunião agendada" });
  };

  const handleExcluir = (id: string) => {
    excluirVisita(id);
    setVisitas(listarVisitas());
    toast({ title: "Removido" });
  };

  const today = todayISO();
  const visitasFiltradas = filtroObra
    ? visitas.filter((v) => v.idObra === filtroObra)
    : visitas;
  const atrasados = visitasFiltradas.filter((v) => v.data < today);
  const hoje = visitasFiltradas.filter((v) => v.data === today);
  const proximos = visitasFiltradas.filter((v) => v.data > today);

  const Section = ({ title, items, icon: Icon, color }: { title: string; items: Visita[]; icon: typeof AlertTriangle; color: string }) => {
    if (items.length === 0) return null;
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Icon className={`h-5 w-5 ${color}`} />
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <Badge variant="secondary" className="text-xs">{items.length}</Badge>
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {items.map((v) => (
            <Card key={v.id} className="border-border/50 bg-card hover:border-primary/30 transition-colors">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 min-w-0">
                    <h3 className="font-semibold text-foreground truncate">{v.nomeObra || "Sem nome"}</h3>
                    <p className="text-sm text-muted-foreground truncate">{v.construtora || "—"}</p>
                  </div>
                  <Badge variant={v.tipo === "reuniao" ? "default" : "secondary"} className="shrink-0 text-xs capitalize">
                    {v.tipo === "reuniao" ? "Reunião" : "Visita"}
                  </Badge>
                </div>

                <div className="flex items-center gap-3 text-sm">
                  <div className="flex items-center gap-1.5 text-foreground font-medium">
                    <CalendarClock className="h-3.5 w-3.5 text-primary" />
                    {formatDateBR(v.data)}
                  </div>
                  <div className="flex items-center gap-1.5 text-foreground font-medium">
                    <Clock className="h-3.5 w-3.5 text-primary" />
                    {v.horario}
                  </div>
                </div>

                {v.comprador && (
                  <p className="text-xs text-muted-foreground">
                    <span className="uppercase tracking-wide">Comprador:</span>{" "}
                    <span className="text-foreground">{v.comprador}</span>
                  </p>
                )}

                {v.observacao && (
                  <p className="text-sm text-muted-foreground bg-muted/50 rounded p-2 line-clamp-3">{v.observacao}</p>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <Button variant="outline" size="sm" asChild className="h-8 text-xs">
                    <a href={`/atividades/${v.idObra}`}>
                      <ExternalLink className="h-3.5 w-3.5 mr-1" />
                      Detalhes
                    </a>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs ml-auto text-destructive hover:text-destructive"
                    onClick={() => handleExcluir(v.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    Excluir
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Visita / Reunião
          </h1>
          <p className="text-muted-foreground mt-1">Agende e acompanhe visitas e reuniões com obras</p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-1" />
              Nova Visita/Reunião
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Agendar Visita/Reunião</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Obra</Label>
                <Popover open={obraPickerOpen} onOpenChange={setObraPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between font-normal"
                      disabled={loadingObras}
                    >
                      {loadingObras ? (
                        <span className="flex items-center gap-2 text-muted-foreground">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Carregando obras...
                        </span>
                      ) : obraSelecionada ? (
                        <span className="truncate">{obraSelecionada.nome} — {obraSelecionada.construtora}</span>
                      ) : (
                        <span className="text-muted-foreground">Selecione uma obra</span>
                      )}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0 pointer-events-auto" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar por nome, ID, cidade ou contato..." />
                      <CommandList>
                        <CommandEmpty>Nenhuma obra encontrada.</CommandEmpty>
                        <CommandGroup>
                          {obras.map((o) => {
                            const search = `${o.nome} ${o.id} ${o.cidade} ${o.construtora} ${o.responsavel}`.toLowerCase();
                            return (
                              <CommandItem
                                key={o.id}
                                value={search}
                                onSelect={() => {
                                  setObraId(o.id || "");
                                  setObraPickerOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    obraId === o.id ? "opacity-100" : "opacity-0",
                                  )}
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <Building2 className="h-3 w-3 text-muted-foreground shrink-0" />
                                    <span className="truncate font-medium">{o.nome || "Sem nome"}</span>
                                  </div>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {[o.id, o.construtora, o.cidade].filter(Boolean).join(" · ")}
                                  </p>
                                </div>
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={tipo} onValueChange={(v) => setTipo(v as TipoEvento)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="visita">Visita</SelectItem>
                    <SelectItem value="reuniao">Reunião</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Data</Label>
                  <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Horário</Label>
                  <Input type="time" value={horario} onChange={(e) => setHorario(e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Observação (opcional)</Label>
                <Textarea
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  placeholder="Endereço, pauta, lembretes..."
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={handleCriar}>Agendar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {visitas.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <CalendarCheck className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">Nenhuma visita ou reunião agendada</p>
            <p className="text-sm text-muted-foreground/70 mt-1">Clique em "Nova Visita/Reunião" para começar</p>
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
