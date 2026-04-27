import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  listarAtividadesPorObra,
  criarAtividade,
  type Atividade,
} from "@/services/atividadesService";
import { buscarObra, type Obra } from "@/services/obrasService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Loader2,
  Phone,
  MessageSquare,
  Mail,
  MapPin,
  CalendarClock,
  Plus,
  History,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const TIPOS = [
  { value: "ligação", label: "Ligação", icon: Phone },
  { value: "whatsapp", label: "WhatsApp", icon: MessageSquare },
  { value: "email", label: "Email", icon: Mail },
  { value: "visita", label: "Visita", icon: MapPin },
] as const;

function tipoIcon(tipo: string) {
  const t = TIPOS.find((x) => x.value === tipo.toLowerCase());
  return t?.icon || CalendarClock;
}

function todayBR(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function isoToBR(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function brToIso(br: string): string {
  if (!br) return "";
  const [d, m, y] = br.split("/");
  if (!y) return "";
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function dateForSort(br: string): string {
  return brToIso(br) || "0000-00-00";
}

export default function Atividades() {
  const { id } = useParams<{ id: string }>();
  const obraId = id || "";
  const { toast } = useToast();

  const [obra, setObra] = useState<Obra | null>(null);
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // form state
  const [tipoContato, setTipoContato] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [proximoContatoIso, setProximoContatoIso] = useState<string>("");
  const [comentario, setComentario] = useState<string>("");

  const carregar = async () => {
    setLoading(true);
    try {
      const [obraData, ativs] = await Promise.all([
        buscarObra(obraId).catch(() => null),
        listarAtividadesPorObra(obraId),
      ]);
      setObra(obraData);
      const ordenadas = [...ativs].sort((a, b) =>
        dateForSort(b.dataAtividade).localeCompare(dateForSort(a.dataAtividade)),
      );
      setAtividades(ordenadas);
    } catch (e) {
      toast({
        title: "Erro ao carregar atividades",
        description: e instanceof Error ? e.message : "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (obraId) carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obraId]);

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tipoContato) {
      toast({ title: "Selecione o tipo de contato", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const nova: Atividade = {
        idObra: obraId,
        dataAtividade: todayBR(),
        tipoContato,
        status: status.trim(),
        proximoContato: isoToBR(proximoContatoIso),
        comentario: comentario.trim(),
      };
      const salva = await criarAtividade(nova);
      setAtividades((prev) =>
        [salva, ...prev].sort((a, b) =>
          dateForSort(b.dataAtividade).localeCompare(dateForSort(a.dataAtividade)),
        ),
      );
      // reset
      setTipoContato("");
      setStatus("");
      setProximoContatoIso("");
      setComentario("");
      toast({ title: "Atividade registrada", description: salva.idAtividade });
    } catch (e) {
      toast({
        title: "Erro ao salvar atividade",
        description: e instanceof Error ? e.message : "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!obraId) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        ID da obra não informado.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
            <Link to="/">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Voltar
            </Link>
          </Button>
          <h1
            className="text-2xl font-bold text-foreground"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Atividades
          </h1>
          <p className="text-muted-foreground mt-1">
            <Badge variant="outline" className="mr-2 font-mono">{obraId}</Badge>
            {obra?.nome || "—"}
            {obra?.construtora ? ` · ${obra.construtora}` : ""}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* Histórico */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-4 w-4" />
              Histórico
              <Badge variant="secondary" className="ml-auto text-xs">
                {atividades.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : atividades.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">
                Nenhuma atividade registrada para esta obra.
              </p>
            ) : (
              <ul className="space-y-3">
                {atividades.map((a) => {
                  const Icon = tipoIcon(a.tipoContato);
                  return (
                    <li
                      key={a.idAtividade}
                      className="border border-border/60 rounded-lg p-3 bg-card hover:border-primary/30 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-primary" />
                          <span className="text-sm font-medium capitalize">
                            {a.tipoContato || "—"}
                          </span>
                          {a.status && (
                            <Badge variant="outline" className="text-xs">
                              {a.status}
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {a.dataAtividade}
                        </span>
                      </div>
                      {a.comentario && (
                        <p className="text-sm text-foreground mt-2 whitespace-pre-wrap">
                          {a.comentario}
                        </p>
                      )}
                      {a.proximoContato && (
                        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                          <CalendarClock className="h-3 w-3" />
                          Próximo contato:{" "}
                          <span className="text-foreground">{a.proximoContato}</span>
                        </p>
                      )}
                      <p className="text-[10px] text-muted-foreground/60 mt-1 font-mono">
                        {a.idAtividade}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Nova atividade */}
        <Card className="h-fit lg:sticky lg:top-20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Plus className="h-4 w-4" />
              Nova atividade
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSalvar} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Tipo de contato *
                </label>
                <Select value={tipoContato} onValueChange={setTipoContato}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Status
                </label>
                <Input
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  placeholder="Ex: Em negociação"
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Próximo contato
                </label>
                <Input
                  type="date"
                  value={proximoContatoIso}
                  onChange={(e) => setProximoContatoIso(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Comentário
                </label>
                <Textarea
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                  placeholder="Detalhes da interação..."
                  rows={4}
                  className="mt-1"
                />
              </div>

              <div className="text-[11px] text-muted-foreground/70">
                <p>Obra: <span className="font-mono">{obraId}</span></p>
                <p>Data: {todayBR()} (preenchida automaticamente)</p>
              </div>

              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Registrar atividade
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
