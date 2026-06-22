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
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check as CheckIcon, ChevronsUpDown } from "lucide-react";
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
  Plus,
  MoreVertical,
  Phone,
  Flame,
  ArrowRight,
  Ban,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { listarObras, atualizarCampoObra, type Obra } from "@/services/obrasService";
import { criarAtividade, listarTodasAtividades, type Atividade } from "@/services/atividadesService";
import { listarPessoas, type Pessoa } from "@/services/pessoasService";
import { normalizeText } from "@/lib/normalize";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { calcularAlertasMichele, type MicheleAlert } from "@/lib/micheleAlerts"; // alertas calculados localmente, sem chamadas Michele
import { getConfig } from "@/services/configuracoesService";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type StatusFiltro = "todos" | "Prospectar" | "Em Prospecção" | "Lead Quente" | "Orçamento Enviado" | "Negociação";

const STATUS_ALVO = new Set(["Prospectar", "Em Prospecção", "Lead Quente", "Orçamento Enviado", "Negociação"]);
const STATUS_ALVO_NORM = new Set(Array.from(STATUS_ALVO).map(normalizeText));

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

function parseEnviarEmail(content: string): {
  destinatario_nome?: string;
  destinatario_email?: string;
  assunto?: string;
  corpo_html?: string;
} | null {
  const m = content.match(ACAO_RE);
  if (!m) return null;
  const bloco = m[1];

  const jm = bloco.match(/\{[\s\S]*\}/);
  if (jm) {
    try {
      const obj = JSON.parse(jm[0]);
      const dados = obj.dados ?? obj;
      if (dados && (dados.assunto || dados.corpo_html)) return dados;
    } catch { /* segue */ }
  }

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
  const [todasObras, setTodasObras] = useState<Obra[]>([]);
  const [obras, setObras] = useState<Obra[]>([]);
  const [stats, setStats] = useState<Record<string, ObraStats>>({});
  const [atividadesMap, setAtividadesMap] = useState<Record<string, Atividade>>({});
  const [alertasMichele, setAlertasMichele] = useState<MicheleAlert[]>([]);
  const [globalStats, setGlobalStats] = useState({
    emailsAbertos: 0,
    linksAbertos: 0,
  });
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState<StatusFiltro>("todos");

  const [acessosLista, setAcessosLista] = useState<any[]>([]);
  const [obraAcessosOpen, setObraAcessosOpen] = useState<Obra | null>(null);

  const [novaProspeccaoOpen, setNovaProspeccaoOpen] = useState(false);
  const [novaObraComboboxOpen, setNovaObraComboboxOpen] = useState(false);
  const [novaContatoComboboxOpen, setNovaContatoComboboxOpen] = useState(false);
  const [selectedNovaObra, setSelectedNovaObra] = useState("");
  const [selectedNovaFase, setSelectedNovaFase] = useState("");
  const [selectedNovaContato, setSelectedNovaContato] = useState(""); // codigoPessoa
  const [pessoasModal, setPessoasModal] = useState<Pessoa[]>([]);
  const [carregandoPessoas, setCarregandoPessoas] = useState(false);
  const [iniciandoProspeccao, setIniciandoProspeccao] = useState(false);

  const [emailObra, setEmailObra] = useState<Obra | null>(null);
  const [enviandoEmail, setEnviandoEmail] = useState(false);
  const [emailDraft, setEmailDraft] = useState({
    destinatario_nome: "",
    destinatario_email: "",
    assunto: "",
    corpo_html: "",
  });

  type Modelo = { id: string; nome: string; assunto: string; corpo_html: string };
  const [modelos, setModelos] = useState<Modelo[]>([]);
  const [modeloSel, setModeloSel] = useState<string>("");
  const [salvandoModelo, setSalvandoModelo] = useState(false);
  const [nomeNovoModelo, setNomeNovoModelo] = useState("");
  const [showSalvarModelo, setShowSalvarModelo] = useState(false);

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
      const [lista, todasAtiv, configVal] = await Promise.all([
        listarObras(),
        listarTodasAtividades(),
        getConfig("dias_orcamento_sem_retorno")
      ]);
      const diasOrc = configVal ? Number(configVal) : 7;
      
      setTodasObras(lista ?? []);
      const filtradas = (lista ?? []).filter((o) =>
        STATUS_ALVO_NORM.has(normalizeText(o.statusProspeccao || "")),
      );
      setObras(filtradas);

      const mapAtiv: Record<string, Atividade> = {};
      for (const at of (todasAtiv ?? [])) {
        if (!at.idObra) continue;
        const cod = at.idObra;
        if (!mapAtiv[cod]) {
          mapAtiv[cod] = at;
        } else {
          const [d1, m1, y1] = at.dataAtividade.split("/");
          const [d2, m2, y2] = mapAtiv[cod].dataAtividade.split("/");
          if (new Date(`${y1}-${m1}-${d1}`).getTime() > new Date(`${y2}-${m2}-${d2}`).getTime()) {
            mapAtiv[cod] = at;
          }
        }
      }
      setAtividadesMap(mapAtiv);
      setAlertasMichele(calcularAlertasMichele(filtradas, mapAtiv, { diasOrcamentoSemRetorno: diasOrc }));

      const codigos = filtradas
        .map((o) => o.codigoObra || (o as any).id)
        .filter(Boolean) as string[];

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
            .select("id,codigoObra,pagina,created_at")
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
        setAcessosLista(ac ?? []);
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

  // Mostra TODAS as obras cadastradas — assim sempre é possível selecionar uma,
  // mesmo que ela já esteja na esteira (re-prospecção ou troca de status).
  const obrasParaIniciar = useMemo(() => {
    return todasObras;
  }, [todasObras]);

  // Fases disponíveis no modal Nova Prospecção (mesmos valores de STATUS_ALVO / registrarAcaoManual)
  const FASES_INICIAIS = [
    "Em Prospecção",
    "Lead Quente",
    "Orçamento Enviado",
    "Negociação",
  ] as const;

  async function abrirNovaProspeccao() {
    setSelectedNovaObra("");
    setSelectedNovaFase("");
    setSelectedNovaContato("");
    setNovaProspeccaoOpen(true);
    // Carrega todas as pessoas uma vez ao abrir o modal
    setCarregandoPessoas(true);
    try {
      const lista = await listarPessoas();
      setPessoasModal(lista ?? []);
    } catch {
      setPessoasModal([]);
    } finally {
      setCarregandoPessoas(false);
    }
  }

  const handleAddNovaProspeccao = async () => {
    if (!selectedNovaObra) return;
    setIniciandoProspeccao(true);
    try {
      const statusAlvo = selectedNovaFase || "Em Prospecção";
      await atualizarCampoObra(selectedNovaObra, "statusProspeccao", statusAlvo);

      const pessoaSelecionada = pessoasModal.find(
        (p) => p.codigoPessoa === selectedNovaContato
      );
      const sufixoContato = pessoaSelecionada
        ? ` — contato: ${pessoaSelecionada.nome}`
        : "";

      await criarAtividade({
        idObra: selectedNovaObra,
        dataAtividade: formatBR(new Date()),
        tipoContato: "observacao",
        status: "Realizado",
        proximoContato: "",
        comentario: `Prospecção iniciada${sufixoContato}`,
      });
      toast({ title: "Obra adicionada à prospecção!", description: `Status: ${statusAlvo}` });
      setNovaProspeccaoOpen(false);
      carregar();
    } catch {
      toast({ title: "Erro ao criar prospecção", variant: "destructive" });
    } finally {
      setIniciandoProspeccao(false);
    }
  };

  async function registrarAcaoManual(obra: Obra, acao: string) {
    const codigo = obra.codigoObra || (obra as any).id;
    const nome = obra.nome || "Obra";

    try {
      if (acao === "iniciar") {
        await atualizarCampoObra(codigo, "statusProspeccao", "Em Prospecção");
        await criarAtividade({
          idObra: codigo,
          dataAtividade: formatBR(new Date()),
          tipoContato: "observacao",
          status: "Realizado",
          proximoContato: "",
          comentario: "Prospecção iniciada",
        });
        toast({ title: "Marcado como Em Prospecção!" });
      } else if (acao === "email" || acao === "whatsapp") {
        await criarAtividade({
          idObra: codigo,
          dataAtividade: formatBR(new Date()),
          tipoContato: acao,
          status: "Realizado",
          proximoContato: "",
          comentario: acao === "email" ? "E-mail enviado" : "WhatsApp enviado",
        });

        // Follow-up criado diretamente via criarAtividade (prazo padrão: 15 dias)
        const DIAS_FOLLOWUP = 15;
        const dataFutura = new Date();
        dataFutura.setDate(dataFutura.getDate() + DIAS_FOLLOWUP);

        await criarAtividade({
          idObra: codigo,
          dataAtividade: formatBR(new Date()),
          tipoContato: "observacao",
          status: "Pendente",
          proximoContato: formatBR(dataFutura),
          comentario: `Follow-up de ${acao} — ${nome}`,
        });

        if (obra.statusProspeccao === "A iniciar" || obra.statusProspeccao === "Prospectar") {
           await atualizarCampoObra(codigo, "statusProspeccao", "Em Prospecção");
        }

        toast({ title: "Atividade registrada", description: `Follow-up agendado para ${formatBR(dataFutura)}.` });
      } else if (acao === "orcamento") {
        await atualizarCampoObra(codigo, "statusProspeccao", "Orçamento Enviado");
        await criarAtividade({
          idObra: codigo,
          dataAtividade: formatBR(new Date()),
          tipoContato: "orcamento",
          status: "Realizado",
          proximoContato: "",
          comentario: "Orçamento enviado",
        });
        toast({ title: "Marcado como Orçamento Enviado!" });
      } else if (acao === "respondeu") {
        await atualizarCampoObra(codigo, "statusProspeccao", "Lead Quente");
        await criarAtividade({
          idObra: codigo,
          dataAtividade: formatBR(new Date()),
          tipoContato: "outro",
          status: "Realizado",
          proximoContato: "",
          comentario: "Cliente respondeu",
        });
        toast({ title: "Marcado como Lead Quente!" });
      } else if (acao === "avancar") {
        await atualizarCampoObra(codigo, "statusProspeccao", "Negociação");
        toast({ title: "Avançou para Negociação" });
      } else if (acao === "encerrar") {
        await atualizarCampoObra(codigo, "statusProspeccao", "Encerrado");
        toast({ title: "Prospecção encerrada" });
      }
      
      await carregar();
    } catch (e) {
      toast({ title: "Erro ao registrar ação", description: String(e), variant: "destructive" });
    }
  }

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
    setEnviandoEmail(true);
    try {
      await registrarAcaoManual(emailObra, "email");
      setEmailObra(null);
    } catch (e) {
      toast({
        title: "Erro ao registrar",
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

      // Criação direta de follow-up via criarAtividade (sem chamada Michele)
      await criarAtividade({
        idObra: codigo,
        dataAtividade: formatBR(new Date()),
        tipoContato: "observacao",
        status: "Pendente",
        proximoContato: formatBR(followDate),
        comentario: followDesc || `Follow-up de prospecção — ${followObra.nome}`,
      });

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
                Gerencie obras em prospecção pelo clique. O envio é manual; a Michele acompanha cliques e acessos.
              </p>
            </div>
          </div>
          <Button onClick={abrirNovaProspeccao}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Prospecção
          </Button>
        </div>

        {/* Alertas da Michele */}
        {alertasMichele.length > 0 && (
          <Card className="bg-orange-50 border-orange-200 shadow-sm">
            <CardHeader className="py-3 px-4 flex flex-row items-center gap-2 border-b border-orange-100">
              <Bot className="h-5 w-5 text-orange-600" />
              <CardTitle className="text-base text-orange-800">O que a Michele recomenda hoje</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-orange-100 max-h-60 overflow-y-auto">
                {alertasMichele.map((alerta) => (
                  <div key={alerta.id} className="p-3 px-4 flex items-start gap-3 hover:bg-orange-100/50 transition-colors">
                    <div className="mt-0.5">
                      <AlertTriangle className="h-4 w-4 text-orange-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-orange-900">{alerta.obraNome}</p>
                      <p className="text-xs text-orange-700 mt-0.5">{alerta.mensagem}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Modal Nova Prospecção */}
        <Dialog open={novaProspeccaoOpen} onOpenChange={(v) => { if (!v) setNovaProspeccaoOpen(false); }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Iniciar Nova Prospecção</DialogTitle>
              <DialogDescription>
                Selecione a obra e, opcionalmente, um contato e a fase inicial.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              {/* 1. Obra */}
              <div className="space-y-1.5">
                <Label>Obra <span className="text-destructive">*</span></Label>
                <Popover open={novaObraComboboxOpen} onOpenChange={setNovaObraComboboxOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-between font-normal text-left truncate">
                      {selectedNovaObra
                        ? obrasParaIniciar.find((o) => (o.codigoObra || (o as any).id) === selectedNovaObra)?.nome
                        : "Selecione uma obra…"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[420px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar por nome ou construtora…" />
                      <CommandList>
                        <CommandEmpty>Nenhuma obra encontrada.</CommandEmpty>
                        <CommandGroup>
                          {obrasParaIniciar.map((o) => {
                            const code = o.codigoObra || (o as any).id;
                            const naEsteira = STATUS_ALVO_NORM.has(normalizeText(o.statusProspeccao || ""));
                            return (
                              <CommandItem
                                key={code}
                                value={`${o.nome} ${o.construtora || ""}`}
                                onSelect={() => {
                                  setSelectedNovaObra(code);
                                  setNovaObraComboboxOpen(false);
                                  // Ao mudar obra, recarrega pessoas filtradas pela construtora
                                  if (o.construtora) {
                                    listarPessoas({ codigoConstrutora: o.construtora })
                                      .then((p) => setPessoasModal(p ?? []))
                                      .catch(() => {});
                                  }
                                }}
                              >
                                <CheckIcon className={cn("mr-2 h-4 w-4 shrink-0", selectedNovaObra === code ? "opacity-100" : "opacity-0")} />
                                <span className="flex-1 truncate">
                                  {o.nome}{o.construtora ? ` — ${o.construtora}` : ""}
                                </span>
                                {naEsteira && (
                                  <span className="ml-2 shrink-0 text-xs text-amber-600 font-medium">
                                    • já na esteira ({o.statusProspeccao})
                                  </span>
                                )}
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* 2. Contato (pessoa) — opcional */}
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1">
                  Contato
                  <span className="text-xs text-muted-foreground font-normal">(opcional)</span>
                </Label>
                <Popover open={novaContatoComboboxOpen} onOpenChange={setNovaContatoComboboxOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-between font-normal text-left truncate" disabled={carregandoPessoas}>
                      {carregandoPessoas
                        ? "Carregando contatos…"
                        : selectedNovaContato
                          ? pessoasModal.find((p) => p.codigoPessoa === selectedNovaContato)?.nome
                          : "Nenhum contato selecionado"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[420px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar contato pelo nome…" />
                      <CommandList>
                        <CommandEmpty>Nenhum contato encontrado.</CommandEmpty>
                        <CommandGroup>
                          {/* Opção para limpar seleção */}
                          {selectedNovaContato && (
                            <CommandItem
                              value="__limpar__"
                              onSelect={() => { setSelectedNovaContato(""); setNovaContatoComboboxOpen(false); }}
                            >
                              <span className="text-muted-foreground italic">— Sem contato específico</span>
                            </CommandItem>
                          )}
                          {pessoasModal.map((p) => (
                            <CommandItem
                              key={p.codigoPessoa}
                              value={`${p.nome} ${p.cargo || ""}`}
                              onSelect={() => { setSelectedNovaContato(p.codigoPessoa ?? ""); setNovaContatoComboboxOpen(false); }}
                            >
                              <CheckIcon className={cn("mr-2 h-4 w-4 shrink-0", selectedNovaContato === p.codigoPessoa ? "opacity-100" : "opacity-0")} />
                              <span className="flex-1 truncate">{p.nome}</span>
                              {p.cargo && <span className="ml-2 text-xs text-muted-foreground">{p.cargo}</span>}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* 3. Fase inicial — opcional */}
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1">
                  Fase inicial
                  <span className="text-xs text-muted-foreground font-normal">(padrão: Em Prospecção)</span>
                </Label>
                <Select value={selectedNovaFase} onValueChange={setSelectedNovaFase}>
                  <SelectTrigger>
                    <SelectValue placeholder="Em Prospecção (padrão)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Em Prospecção">Em Prospecção</SelectItem>
                    <SelectItem value="Lead Quente">Lead Quente</SelectItem>
                    <SelectItem value="Orçamento Enviado">Orçamento Enviado</SelectItem>
                    <SelectItem value="Negociação">Negociação</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="mt-2">
              <Button variant="outline" onClick={() => setNovaProspeccaoOpen(false)} disabled={iniciandoProspeccao}>
                Cancelar
              </Button>
              <Button onClick={handleAddNovaProspeccao} disabled={!selectedNovaObra || iniciandoProspeccao}>
                {iniciandoProspeccao && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Adicionar à Prospecção
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
                <SelectItem value="Lead Quente">Lead Quente</SelectItem>
                <SelectItem value="Orçamento Enviado">Orçamento Enviado</SelectItem>
                <SelectItem value="Negociação">Negociação</SelectItem>
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
                const statusAtivo = o.statusProspeccao;
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
                          variant={statusAtivo === "Lead Quente" ? "destructive" : "secondary"}
                          className={cn("text-xs", statusAtivo === "Lead Quente" && "bg-orange-500 hover:bg-orange-600")}
                        >
                          {o.statusProspeccao || "—"}
                        </Badge>
                        {teveEvento && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => setObraAcessosOpen(o)}
                                className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400 font-medium hover:underline focus:outline-none"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                abriu há {recente}
                              </button>
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
                      
                      {atividadesMap[codigo] && (
                        <div className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1.5 bg-muted/30 px-2 py-1 rounded-md w-fit">
                          <Clock className="h-3 w-3" />
                          Última ação: {atividadesMap[codigo].comentario} ({atividadesMap[codigo].dataAtividade})
                        </div>
                      )}
                      
                      {s && s.acessosSite > 0 && (
                        <div className="mt-1.5">
                          <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-200 bg-emerald-50">
                            <Flame className="h-3 w-3 mr-1" /> Cliente viu o site!
                          </Badge>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap shrink-0">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm">
                            Ações <MoreVertical className="h-3.5 w-3.5 ml-1" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => registrarAcaoManual(o, "iniciar")}>
                            <ArrowRight className="h-4 w-4 mr-2 text-primary" />
                            Iniciar prospecção
                          </DropdownMenuItem>
                          
                          <DropdownMenuItem onClick={() => abrirModalEmail(o)}>
                            <Mail className="h-4 w-4 mr-2 text-primary" />
                            Gerar e-mail (Modelo)
                          </DropdownMenuItem>

                          <DropdownMenuItem onClick={() => registrarAcaoManual(o, "email")}>
                            <CheckIcon className="h-4 w-4 mr-2 text-emerald-600" />
                            Enviei e-mail (Marcar)
                          </DropdownMenuItem>
                          
                          <DropdownMenuItem onClick={() => registrarAcaoManual(o, "whatsapp")}>
                            <Phone className="h-4 w-4 mr-2 text-emerald-600" />
                            Enviei WhatsApp
                          </DropdownMenuItem>
                          
                          <DropdownMenuItem onClick={() => registrarAcaoManual(o, "respondeu")}>
                            <Flame className="h-4 w-4 mr-2 text-orange-500" />
                            Cliente respondeu!
                          </DropdownMenuItem>
                          
                          <DropdownMenuItem onClick={() => registrarAcaoManual(o, "orcamento")}>
                            <CheckIcon className="h-4 w-4 mr-2 text-blue-600" />
                            Enviei Orçamento
                          </DropdownMenuItem>
                          
                          <DropdownMenuItem onClick={() => registrarAcaoManual(o, "avancar")}>
                            <CheckIcon className="h-4 w-4 mr-2 text-muted-foreground" />
                            Avançar para Negociação
                          </DropdownMenuItem>
                          
                          <DropdownMenuItem onClick={() => registrarAcaoManual(o, "encerrar")}>
                            <Ban className="h-4 w-4 mr-2 text-red-500" />
                            Encerrar / Perda
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>

                      {/* Botão de Follow-up nativo preservado, caso precise agendar algo manualmente */}
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
                          <Button size="sm" variant="outline" title="Agendar follow-up manual">
                            <CalendarClock className="h-4 w-4" />
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
                            Criar
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
                Copie o texto para enviar no seu cliente de e-mail. A Michele acompanha cliques no link e acessos.
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
                Marquei: enviei e-mail
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal Acessos ao site */}
        <Dialog open={!!obraAcessosOpen} onOpenChange={(o) => { if (!o) setObraAcessosOpen(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-emerald-600" />
                Acessos ao site
              </DialogTitle>
              <DialogDescription>
                {obraAcessosOpen?.nome}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 max-h-80 overflow-auto pr-2">
              {acessosLista
                .filter((a) => a.codigoObra === (obraAcessosOpen?.codigoObra || (obraAcessosOpen as any)?.id))
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .map((a) => (
                  <div key={a.id} className="p-3 bg-muted/40 rounded-md border text-sm">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-semibold text-foreground/80">Página: {a.pagina || "Home"}</span>
                      <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                        {new Date(a.created_at).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                        })}{" "}
                        às{" "}
                        {new Date(a.created_at).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                ))}
              {acessosLista.filter((a) => a.codigoObra === (obraAcessosOpen?.codigoObra || (obraAcessosOpen as any)?.id)).length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-4">Nenhum acesso detalhado encontrado.</div>
              )}
            </div>
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
