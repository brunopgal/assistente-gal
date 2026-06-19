import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Mail,
  MessageCircle,
  CalendarClock,
  Eye,
  Loader2,
  Send,
  Search,
  Sparkles,
  Building2,
  MapPin,
  Bot,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { listarObras, atualizarCampoObra, type Obra } from "@/services/obrasService";
import { normalizeText } from "@/lib/normalize";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type StatusFiltro = "todos" | "Prospectar" | "Em Prospecção";

const STATUS_ALVO = new Set(["prospectar", "em prospeccao"]);

function todayBR(): string {
  return new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function formatBR(d: Date): string {
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function relativo(dataIso: string): string {
  const d = new Date(dataIso);
  if (isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const dias = Math.floor(h / 24);
  if (dias < 30) return `${dias}d`;
  const meses = Math.floor(dias / 30);
  return `${meses}mes`;
}

const ACAO_RE = /\[ACAO\]([\s\S]*?)\[\/ACAO\]/i;

// Extrai dados do bloco [ACAO]. Aceita tanto o formato `tipo:`/`dados:` quanto
// um JSON wrapper {"tipo":"...","dados":{...}}.
function parseEnviarEmail(content: string): {
  destinatario_nome?: string;
  destinatario_email?: string;
  assunto?: string;
  corpo_html?: string;
} | null {
  const m = content.match(ACAO_RE);
  if (!m) return null;
  const bloco = m[1];

  // tentativa 1: JSON puro envolvido em chaves
  const jm = bloco.match(/\{[\s\S]*\}/);
  if (jm) {
    try {
      const obj = JSON.parse(jm[0]);
      const dados = obj.dados ?? obj;
      if (dados && (dados.assunto || dados.corpo_html)) return dados;
    } catch { /* segue */ }
  }

  // tentativa 2: linhas tipo:/dados:
  const dadosMatch = /dados\s*:\s*([\s\S]+)/i.exec(bloco);
  if (dadosMatch) {
    const raw = dadosMatch[1].trim();
    try {
      return JSON.parse(raw);
    } catch {
      const jm2 = raw.match(/\{[\s\S]*\}/);
      if (jm2) {
        try { return JSON.parse(jm2[0]); } catch { /* nada */ }
      }
    }
  }
  return null;
}

interface ObraStats {
  emailsAbertos: number;
  cliquesEmail: number;
  acessosSite: number;
  ultimoEvento?: string; // ISO
}

export default function Prospeccao() {
  const { toast } = useToast();
  const [obras, setObras] = useState<Obra[]>([]);
  const [stats, setStats] = useState<Record<string, ObraStats>>({});
  const [globalStats, setGlobalStats] = useState({
    emailsAbertos: 0,
    linksAbertos: 0,
  });
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState<StatusFiltro>("todos");

  // Modal e-mail
  const [emailObra, setEmailObra] = useState<Obra | null>(null);
  const [enviandoEmail, setEnviandoEmail] = useState(false);
  const [emailDraft, setEmailDraft] = useState({
    destinatario_nome: "",
    destinatario_email: "",
    assunto: "",
    corpo_html: "",
  });

  // Modelos de e-mail
  type Modelo = { id: string; nome: string; assunto: string; corpo_html: string };
  const [modelos, setModelos] = useState<Modelo[]>([]);
  const [modeloSel, setModeloSel] = useState<string>("");
  const [salvandoModelo, setSalvandoModelo] = useState(false);
  const [nomeNovoModelo, setNomeNovoModelo] = useState("");
  const [showSalvarModelo, setShowSalvarModelo] = useState(false);

  // Follow-up popover por obra
  const [followObra, setFollowObra] = useState<Obra | null>(null);
  const [followDate, setFollowDate] = useState<Date | undefined>(undefined);
  const [followDesc, setFollowDesc] = useState("");
  const [criandoFollow, setCriandoFollow] = useState(false);

  useEffect(() => {
    carregar();
  }, []);

  async function carregar() {
    setLoading(true);
    try {
      const lista = await listarObras();
      const filtradas = (lista ?? []).filter((o) =>
        STATUS_ALVO.has(normalizeText(o.statusProspeccao || "")),
      );
      setObras(filtradas);

      const codigos = filtradas
        .map((o) => o.codigoObra || (o as any).id)
        .filter(Boolean) as string[];

      // Stats por obra: e-mail eventos (opened/clicked) + acessos_site
      const novos: Record<string, ObraStats> = {};
      let totalAbertos = 0;
      let totalLinks = 0;

      if (codigos.length > 0) {
        const [{ data: ev }, { data: ac }] = await Promise.all([
          supabase
            .from("email_eventos")
            .select("codigoObra,tipo_evento,created_at")
            .in("codigoObra", codigos),
          supabase
            .from("acessos_site")
            .select("codigoObra,created_at")
            .in("codigoObra", codigos),
        ]);

        for (const e of (ev ?? []) as any[]) {
          const cod = e.codigoObra as string;
          const s = (novos[cod] ??= {
            emailsAbertos: 0, cliquesEmail: 0, acessosSite: 0,
          });
          const tipo = String(e.tipo_evento || "").toLowerCase();
          if (tipo === "opened" || tipo === "open") {
            s.emailsAbertos++;
            totalAbertos++;
          } else if (tipo === "clicked" || tipo === "click") {
            s.cliquesEmail++;
          }
          if (!s.ultimoEvento || e.created_at > s.ultimoEvento) {
            s.ultimoEvento = e.created_at;
          }
        }
        for (const a of (ac ?? []) as any[]) {
          const cod = a.codigoObra as string;
          if (!cod) continue;
          const s = (novos[cod] ??= {
            emailsAbertos: 0, cliquesEmail: 0, acessosSite: 0,
          });
          s.acessosSite++;
          totalLinks++;
          if (!s.ultimoEvento || a.created_at > s.ultimoEvento) {
            s.ultimoEvento = a.created_at;
          }
        }
      }

      setStats(novos);
      setGlobalStats({ emailsAbertos: totalAbertos, linksAbertos: totalLinks });
    } catch (e) {
      toast({
        title: "Erro ao carregar obras",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  const filtradas = useMemo(() => {
    const q = normalizeText(busca);
    return obras.filter((o) => {
      if (statusFiltro !== "todos") {
        if (normalizeText(o.statusProspeccao) !== normalizeText(statusFiltro)) return false;
      }
      if (!q) return true;
      const blob = normalizeText(
        [o.nome, o.construtora, o.cidade, o.produtoOferecido, o.responsavel, o.codigoObra]
          .filter(Boolean).join(" "),
      );
      return blob.includes(q);
    });
  }, [obras, busca, statusFiltro]);

  // ============ E-mail flow ============
  async function carregarModelos() {
    const { data, error } = await supabase
      .from("modelos_email")
      .select("id,nome,assunto,corpo_html")
      .order("nome", { ascending: true });
    if (!error) setModelos((data ?? []) as Modelo[]);
  }

  useEffect(() => {
    carregarModelos();
  }, []);

  function abrirModalEmail(obra: Obra) {
    setEmailObra(obra);
    setModeloSel("");
    setEmailDraft({
      destinatario_nome: obra.responsavel || "",
      destinatario_email: obra.email || "",
      assunto: "",
      corpo_html: "",
    });
  }

  function aplicarModelo(id: string) {
    setModeloSel(id);
    const m = modelos.find((x) => x.id === id);
    if (!m) return;
    setEmailDraft((d) => ({
      ...d,
      assunto: m.assunto || d.assunto,
      corpo_html: m.corpo_html || d.corpo_html,
    }));
  }

  function inserirLinkRastreado() {
    if (!emailObra) return;
    const codigo = emailObra.codigoObra || (emailObra as any).id;
    const link = `https://galrepresentacoes.lovable.app?ref=${encodeURIComponent(codigo)}`;
    const snippet = `<p><a href="${link}">Conheça a Gal Representações</a></p>`;
    setEmailDraft((d) =>
      d.corpo_html.includes(link)
        ? d
        : { ...d, corpo_html: (d.corpo_html || "") + (d.corpo_html ? "\n" : "") + snippet },
    );
    toast({ title: "Link inserido no corpo do e-mail" });
  }

  async function salvarComoModelo() {
    const nome = nomeNovoModelo.trim();
    if (!nome) {
      toast({ title: "Dê um nome para o modelo", variant: "destructive" });
      return;
    }
    if (!emailDraft.assunto && !emailDraft.corpo_html) {
      toast({ title: "Modelo vazio", variant: "destructive" });
      return;
    }
    setSalvandoModelo(true);
    try {
      const { error } = await supabase.from("modelos_email").insert({
        nome,
        assunto: emailDraft.assunto,
        corpo_html: emailDraft.corpo_html,
      });
      if (error) throw error;
      toast({ title: "Modelo salvo", description: nome });
      setNomeNovoModelo("");
      setShowSalvarModelo(false);
      await carregarModelos();
    } catch (e) {
      toast({
        title: "Erro ao salvar modelo",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setSalvandoModelo(false);
    }
  }

  async function aprovarEEnviar() {
    if (!emailObra) return;
    if (!emailDraft.destinatario_email || !emailDraft.assunto || !emailDraft.corpo_html) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha destinatário, assunto e corpo.",
        variant: "destructive",
      });
      return;
    }
    setEnviandoEmail(true);
    try {
      const codigo = emailObra.codigoObra || (emailObra as any).id;
      const { data, error } = await supabase.functions.invoke("michele-enviar-email", {
        body: {
          codigoObra: codigo,
          destinatario_nome: emailDraft.destinatario_nome,
          destinatario_email: emailDraft.destinatario_email,
          assunto: emailDraft.assunto,
          corpo_html: emailDraft.corpo_html,
        },
      });
      if (error) throw new Error(error.message || "Falha ao enviar");
      if (data?.error) throw new Error(data.error);

      // Atualiza status para "Em Prospecção" se ainda estiver "Prospectar"
      if (normalizeText(emailObra.statusProspeccao) === "prospectar") {
        try {
          await atualizarCampoObra(codigo, "statusProspeccao", "Em Prospecção");
          setObras((prev) =>
            prev.map((o) =>
              (o.codigoObra || (o as any).id) === codigo
                ? { ...o, statusProspeccao: "Em Prospecção" }
                : o,
            ),
          );
        } catch (e) {
          console.warn("Falha ao mudar status:", e);
        }
      }

      toast({
        title: "E-mail enviado",
        description: `Para ${emailDraft.destinatario_email}.`,
      });
      setEmailObra(null);
    } catch (e) {
      toast({
        title: "Erro ao enviar e-mail",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setEnviandoEmail(false);
    }
  }

  // ============ Follow-up ============
  async function criarFollowUp() {
    if (!followObra || !followDate) {
      toast({ title: "Escolha uma data", variant: "destructive" });
      return;
    }
    setCriandoFollow(true);
    try {
      const codigo = followObra.codigoObra || (followObra as any).id;
      const { data, error } = await supabase.functions.invoke("michele-executar-acao", {
        body: {
          tipo: "criar_followup",
          dados: {
            codigoObra: codigo,
            descricao: followDesc || `Follow-up de prospecção — ${followObra.nome}`,
            data_prevista: formatBR(followDate),
            prioridade: "normal",
            responsavel: "michele",
          },
        },
      });
      if (error) throw new Error(error.message || "Falha");
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Follow-up criado",
        description: `${followObra.nome} em ${formatBR(followDate)}.`,
      });
      setFollowObra(null);
      setFollowDate(undefined);
      setFollowDesc("");
    } catch (e) {
      toast({
        title: "Erro ao criar follow-up",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setCriandoFollow(false);
    }
  }

  const counts = {
    aProspectar: obras.length,
    emailsAbertos: globalStats.emailsAbertos,
    linksAbertos: globalStats.linksAbertos,
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                Michele · Prospecção
              </h1>
              <p className="text-sm text-muted-foreground">
                Gerencie obras em prospecção pelo clique. Você escreve o e-mail; a Michele envia e acompanha.
              </p>
            </div>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ResumoCard
            icon={<Sparkles className="h-5 w-5" />}
            label="A prospectar"
            value={counts.aProspectar}
            accent="text-primary"
          />
          <ResumoCard
            icon={<Mail className="h-5 w-5" />}
            label="E-mails abertos"
            value={counts.emailsAbertos}
            accent="text-emerald-600"
          />
          <ResumoCard
            icon={<Eye className="h-5 w-5" />}
            label="Links do site abertos"
            value={counts.linksAbertos}
            accent="text-emerald-600"
          />
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="pt-6 flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por obra, construtora, cidade, produto…"
                className="pl-9"
              />
            </div>
            <Select value={statusFiltro} onValueChange={(v) => setStatusFiltro(v as StatusFiltro)}>
              <SelectTrigger className="md:w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="Prospectar">Prospectar</SelectItem>
                <SelectItem value="Em Prospecção">Em Prospecção</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Lista */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Obras em prospecção ({filtradas.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando…
              </div>
            ) : filtradas.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Nenhuma obra encontrada para os filtros atuais.
              </div>
            ) : (
              filtradas.map((o) => {
                const codigo = o.codigoObra || (o as any).id;
                const s = stats[codigo];
                const teveEvento = s && (s.emailsAbertos > 0 || s.acessosSite > 0);
                const recente = teveEvento && s.ultimoEvento ? relativo(s.ultimoEvento) : "";
                const statusAtivo = normalizeText(o.statusProspeccao);
                return (
                  <div
                    key={codigo}
                    className={cn(
                      "flex flex-col md:flex-row md:items-center gap-3 p-4 rounded-lg border bg-card hover:shadow-sm transition",
                      teveEvento && "ring-1 ring-emerald-500/40",
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold truncate">{o.nome || "(sem nome)"}</span>
                        <Badge
                          variant={statusAtivo === "prospectar" ? "secondary" : "default"}
                          className="text-xs"
                        >
                          {o.statusProspeccao || "—"}
                        </Badge>
                        {teveEvento && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                                <Eye className="h-3.5 w-3.5" />
                                abriu há {recente}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              {s.emailsAbertos > 0 && <div>{s.emailsAbertos} aberturas de e-mail</div>}
                              {s.cliquesEmail > 0 && <div>{s.cliquesEmail} cliques no e-mail</div>}
                              {s.acessosSite > 0 && <div>{s.acessosSite} acessos ao site</div>}
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
                        {o.construtora && (
                          <span className="inline-flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {o.construtora}
                          </span>
                        )}
                        {o.cidade && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {o.cidade}
                          </span>
                        )}
                        {o.produtoOferecido && (
                          <span className="inline-flex items-center gap-1">
                            <Sparkles className="h-3 w-3" />
                            {o.produtoOferecido}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <Button
                        size="sm"
                        onClick={() => abrirModalEmail(o)}
                        disabled={!o.email && !o.responsavel}
                        title={!o.email ? "Sem e-mail cadastrado na obra" : "Gerar e-mail de prospecção"}
                      >
                        <Mail className="h-4 w-4 mr-1.5" />
                        E-mail
                      </Button>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          {/* span wraps disabled button so tooltip works */}
                          <span>
                            <Button size="sm" variant="outline" disabled>
                              <MessageCircle className="h-4 w-4 mr-1.5" />
                              WhatsApp
                            </Button>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>em breve</TooltipContent>
                      </Tooltip>

                      <Popover
                        open={!!followObra && (followObra.codigoObra || (followObra as any).id) === codigo}
                        onOpenChange={(open) => {
                          if (open) {
                            setFollowObra(o);
                            setFollowDate(undefined);
                            setFollowDesc("");
                          } else {
                            setFollowObra(null);
                          }
                        }}
                      >
                        <PopoverTrigger asChild>
                          <Button size="sm" variant="outline">
                            <CalendarClock className="h-4 w-4 mr-1.5" />
                            Follow-up
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-3 space-y-3" align="end">
                          <div className="text-sm font-medium">{o.nome}</div>
                          <Calendar
                            mode="single"
                            selected={followDate}
                            onSelect={setFollowDate}
                            initialFocus
                            className="p-0 pointer-events-auto"
                          />
                          <div>
                            <Label className="text-xs">Descrição (opcional)</Label>
                            <Input
                              value={followDesc}
                              onChange={(e) => setFollowDesc(e.target.value)}
                              placeholder="ex: Ligar para confirmar interesse"
                              className="mt-1"
                            />
                          </div>
                          <Button
                            size="sm"
                            className="w-full"
                            disabled={!followDate || criandoFollow}
                            onClick={criarFollowUp}
                          >
                            {criandoFollow ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                            ) : (
                              <CalendarClock className="h-4 w-4 mr-1.5" />
                            )}
                            Criar follow-up
                          </Button>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Modal e-mail */}
        <Dialog open={!!emailObra} onOpenChange={(o) => { if (!o) setEmailObra(null); }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-primary" />
                E-mail de prospecção
              </DialogTitle>
              <DialogDescription>
                {emailObra?.nome} {emailObra?.construtora ? `· ${emailObra.construtora}` : ""}
                <br />
                Você escreve o e-mail. A Michele apenas envia e acompanha (abertura, clique, follow-up).
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              {/* Seletor de modelo */}
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Label className="text-xs">Modelo salvo (opcional)</Label>
                  <Select value={modeloSel} onValueChange={aplicarModelo}>
                    <SelectTrigger>
                      <SelectValue placeholder={modelos.length ? "Escolher modelo…" : "Nenhum modelo salvo ainda"} />
                    </SelectTrigger>
                    <SelectContent>
                      {modelos.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSalvarModelo((v) => !v)}
                >
                  {showSalvarModelo ? "Cancelar" : "Salvar como modelo"}
                </Button>
              </div>

              {showSalvarModelo && (
                <div className="flex items-end gap-2 p-3 rounded-md border bg-muted/30">
                  <div className="flex-1">
                    <Label className="text-xs">Nome do modelo</Label>
                    <Input
                      value={nomeNovoModelo}
                      onChange={(e) => setNomeNovoModelo(e.target.value)}
                      placeholder="Ex: Apresentação Rohden"
                    />
                  </div>
                  <Button size="sm" disabled={salvandoModelo} onClick={salvarComoModelo}>
                    {salvandoModelo ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
                  </Button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Destinatário</Label>
                  <Input
                    value={emailDraft.destinatario_nome}
                    onChange={(e) =>
                      setEmailDraft((d) => ({ ...d, destinatario_nome: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs">E-mail</Label>
                  <Input
                    type="email"
                    value={emailDraft.destinatario_email}
                    onChange={(e) =>
                      setEmailDraft((d) => ({ ...d, destinatario_email: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">Assunto</Label>
                <Input
                  value={emailDraft.assunto}
                  onChange={(e) => setEmailDraft((d) => ({ ...d, assunto: e.target.value }))}
                  placeholder="Escreva o assunto do e-mail"
                />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Corpo (HTML)</Label>
                  <Button type="button" variant="ghost" size="sm" onClick={inserirLinkRastreado}>
                    Inserir link rastreado
                  </Button>
                </div>
                <Textarea
                  rows={14}
                  value={emailDraft.corpo_html}
                  onChange={(e) =>
                    setEmailDraft((d) => ({ ...d, corpo_html: e.target.value }))
                  }
                  className="font-mono text-xs"
                  placeholder="Escreva o e-mail aqui (HTML)…"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Se você não inserir, o link de rastreio é adicionado automaticamente no envio.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setEmailObra(null)} disabled={enviandoEmail}>
                Cancelar
              </Button>
              <Button onClick={aprovarEEnviar} disabled={enviandoEmail}>
                {enviandoEmail ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                ) : (
                  <Send className="h-4 w-4 mr-1.5" />
                )}
                Enviar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

function ResumoCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-muted-foreground">{label}</div>
            <div className="text-3xl font-bold mt-1">{value}</div>
          </div>
          <div className={cn("h-10 w-10 rounded-lg bg-muted flex items-center justify-center", accent)}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
