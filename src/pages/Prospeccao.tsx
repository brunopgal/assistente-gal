import { useEffect, useMemo, useState, useRef } from "react";
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
  CalendarClock,
  Eye,
  Loader2,
  Search,
  Sparkles,
  Building2,
  MapPin,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Plus,
  MoreVertical,
  Phone,
  Flame,
  ArrowRight,
  Ban,
  Clock,
  Mic,
  MicOff,
  Users
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { listarObras, atualizarCampoObra, type Obra } from "@/services/obrasService";
import { criarAtividade, listarTodasAtividades, type Atividade } from "@/services/atividadesService";
import { getConfig } from "@/services/configuracoesService";
import { listarPessoas, type Pessoa } from "@/services/pessoasService";
import { normalizeText } from "@/lib/normalize";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { STATUS_PROSPECCAO_ATIVOS, type StatusProspeccao } from "@/lib/statusProspeccao";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type StatusFiltro = "todos" | StatusProspeccao;

const STATUS_ALVO_NORM = new Set(Array.from(STATUS_PROSPECCAO_ATIVOS).map(normalizeText));

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



interface ObraStats {
  emailsAbertos: number;
  cliquesEmail: number;
  acessosSite: number;
  ultimoEvento?: string; // ISO
}

export default function Prospeccao() {
  const { toast } = useToast();
  const [todasObras, setTodasObras] = useState<Obra[]>([]);
  const [configFollow, setConfigFollow] = useState({ email: 10, whatsapp: 7, orcamento: 15 });
  const [acaoDialogDias, setAcaoDialogDias] = useState<number | null>(null);
  const [acaoDialogOcorrencia, setAcaoDialogOcorrencia] = useState<{obra: Obra, acao: string, title: string} | null>(null);
  const [acaoDialogDetalhes, setAcaoDialogDetalhes] = useState("");
  const [acaoDialogIsRecording, setAcaoDialogIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);
  const isRecordingRef = useRef(false);
  const startingTextRef = useRef("");

  useEffect(() => {
    if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.lang = 'pt-BR';
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;

      recognitionRef.current.onresult = (event: any) => {
        let finalSegment = '';
        let interimSegment = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalSegment += event.results[i][0].transcript;
          } else {
            interimSegment += event.results[i][0].transcript;
          }
        }
        if (finalSegment) {
          startingTextRef.current += finalSegment;
        }
        setAcaoDialogDetalhes(startingTextRef.current + interimSegment);
      };

      recognitionRef.current.onerror = (event: any) => {
        if (event.error !== 'no-speech') {
          console.error("Speech recognition error:", event.error);
          isRecordingRef.current = false;
          setAcaoDialogIsRecording(false);
        }
      };

      recognitionRef.current.onend = () => {
        if (isRecordingRef.current) {
          try {
            recognitionRef.current.start();
          } catch(e) {
            isRecordingRef.current = false;
            setAcaoDialogIsRecording(false);
          }
        } else {
          setAcaoDialogIsRecording(false);
        }
      };
    }
  }, []);

  const toggleRecording = () => {
    if (acaoDialogIsRecording) {
      isRecordingRef.current = false;
      recognitionRef.current?.stop();
      setAcaoDialogIsRecording(false);
    } else {
      if (recognitionRef.current) {
        // Prepara texto base atual (com espaço se já houver algo)
        const currentText = acaoDialogDetalhes.trim();
        startingTextRef.current = currentText ? currentText + ' ' : '';
        setAcaoDialogDetalhes(startingTextRef.current);

        isRecordingRef.current = true;
        setAcaoDialogIsRecording(true);
        try {
          recognitionRef.current.start();
        } catch(e) {}
      }
    }
  };

  const stopRecordingAndClear = () => {
    isRecordingRef.current = false;
    recognitionRef.current?.stop();
    setAcaoDialogIsRecording(false);
  };
  const [obras, setObras] = useState<Obra[]>([]);
  const [stats, setStats] = useState<Record<string, ObraStats>>({});
  const [atividadesMap, setAtividadesMap] = useState<Record<string, Atividade>>({});

  const [globalStats, setGlobalStats] = useState({
    emailsAbertos: 0,
    linksAbertos: 0,
  });
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState<StatusFiltro>("todos");
  const [sortDesc, setSortDesc] = useState(true);

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
      const [lista, todasAtiv, confEmail, confWpp, confOrc] = await Promise.all([
        listarObras(),
        listarTodasAtividades(),
        getConfig("dias_followup_email"),
        getConfig("dias_followup_whatsapp"),
        getConfig("dias_followup_orcamento")
      ]);
      setConfigFollow({
        email: confEmail ? Number(confEmail) : 10,
        whatsapp: confWpp ? Number(confWpp) : 7,
        orcamento: confOrc ? Number(confOrc) : 15
      });
      
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
    const result = obras.filter((o) => {
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

    result.sort((a, b) => {
      const aDate = new Date((a as any).updated_at || a.dataCadastro || 0).getTime();
      const bDate = new Date((b as any).updated_at || b.dataCadastro || 0).getTime();
      return sortDesc ? bDate - aDate : aDate - bDate;
    });

    return result;
  }, [obras, busca, statusFiltro, sortDesc]);

  // Mostra TODAS as obras cadastradas — assim sempre é possível selecionar uma,
  // mesmo que ela já esteja na esteira (re-prospecção ou troca de status).
  const obrasParaIniciar = useMemo(() => {
    return todasObras;
  }, [todasObras]);

  // Fases disponíveis no modal Nova Prospecção (mesmos valores de STATUS_PROSPECCAO_ATIVOS)
  const FASES_INICIAIS = Array.from(STATUS_PROSPECCAO_ATIVOS);

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
      await atualizarCampoObra(selectedNovaObra, "statusDesde", formatBR(new Date()));

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

  async function registrarAcaoManual(obra: Obra, acao: string, detalhesOpcionais?: string, diasFollowUp?: number | null) {
    const codigo = obra.codigoObra || (obra as any).id;
    const nome = obra.nome || "Obra";

    try {
      if (acao === "iniciar") {
        await atualizarCampoObra(codigo, "statusProspeccao", "Em Prospecção");
        await atualizarCampoObra(codigo, "statusDesde", formatBR(new Date()));
        await criarAtividade({
          idObra: codigo,
          dataAtividade: formatBR(new Date()),
          tipoContato: "observacao",
          status: "Realizado",
          proximoContato: "",
          comentario: detalhesOpcionais || "Prospecção iniciada",
        });
        toast({ title: "Marcado como Em Prospecção!" });
      } else if (acao === "email" || acao === "whatsapp") {
        await criarAtividade({
          idObra: codigo,
          dataAtividade: formatBR(new Date()),
          tipoContato: acao,
          status: "Realizado",
          proximoContato: "",
          comentario: detalhesOpcionais || (acao === "email" ? "E-mail enviado" : "WhatsApp enviado"),
        });

        // Follow-up criado diretamente via criarAtividade (prazo dinâmico)
        const DIAS_FOLLOWUP = diasFollowUp ?? 15;
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

        await atualizarCampoObra(codigo, "proximoContato", formatBR(dataFutura));

        if (obra.statusProspeccao === "A iniciar" || obra.statusProspeccao === "Prospectar") {
           await atualizarCampoObra(codigo, "statusProspeccao", "Em Prospecção");
           await atualizarCampoObra(codigo, "statusDesde", formatBR(new Date()));
        }

        toast({ title: "Atividade registrada", description: `Follow-up agendado para ${formatBR(dataFutura)}.` });
      } else if (acao === "visitei") {
        await criarAtividade({
          idObra: codigo,
          dataAtividade: formatBR(new Date()),
          tipoContato: "visita",
          status: "Realizado",
          proximoContato: "",
          comentario: detalhesOpcionais || "Visitei a obra",
        });
        toast({ title: "Visita registrada!" });
      } else if (acao === "reuniao") {
        await criarAtividade({
          idObra: codigo,
          dataAtividade: formatBR(new Date()),
          tipoContato: "reuniao",
          status: "Realizado",
          proximoContato: "",
          comentario: detalhesOpcionais || "Fiz reunião",
        });
        toast({ title: "Reunião registrada!" });
      } else if (acao === "comecei_orcamento") {
        await atualizarCampoObra(codigo, "statusProspeccao", "Fazendo Orçamento");
        await atualizarCampoObra(codigo, "statusDesde", formatBR(new Date()));
        await criarAtividade({
          idObra: codigo,
          dataAtividade: formatBR(new Date()),
          tipoContato: "observacao",
          status: "Realizado",
          proximoContato: "",
          comentario: detalhesOpcionais || "Comecei orçamento",
        });
        toast({ title: "Marcado como Fazendo Orçamento!" });
      } else if (acao === "orcamento") {
        await atualizarCampoObra(codigo, "statusProspeccao", "Orçamento Enviado");
        await atualizarCampoObra(codigo, "statusDesde", formatBR(new Date()));
        await criarAtividade({
          idObra: codigo,
          dataAtividade: formatBR(new Date()),
          tipoContato: "orcamento",
          status: "Realizado",
          proximoContato: "",
          comentario: detalhesOpcionais || "Orçamento enviado",
        });

        // Agendar follow-up automático de orçamento
        const DIAS_FOLLOWUP = diasFollowUp ?? 15;
        const dataFutura = new Date();
        dataFutura.setDate(dataFutura.getDate() + DIAS_FOLLOWUP);

        await criarAtividade({
          idObra: codigo,
          dataAtividade: formatBR(new Date()),
          tipoContato: "observacao",
          status: "Pendente",
          proximoContato: formatBR(dataFutura),
          comentario: `Follow-up de orçamento — ${nome}`,
        });

        await atualizarCampoObra(codigo, "proximoContato", formatBR(dataFutura));

        toast({ title: "Marcado como Orçamento Enviado!", description: `Follow-up agendado para ${formatBR(dataFutura)}.` });
      } else if (acao === "respondeu") {
        await atualizarCampoObra(codigo, "statusProspeccao", "Lead Quente");
        await atualizarCampoObra(codigo, "statusDesde", formatBR(new Date()));
        await criarAtividade({
          idObra: codigo,
          dataAtividade: formatBR(new Date()),
          tipoContato: "outro",
          status: "Realizado",
          proximoContato: "",
          comentario: detalhesOpcionais || "Cliente respondeu",
        });
        toast({ title: "Marcado como Lead Quente!" });
      } else if (acao === "avancar") {
        await atualizarCampoObra(codigo, "statusProspeccao", "Negociação");
        await atualizarCampoObra(codigo, "statusDesde", formatBR(new Date()));
        if (detalhesOpcionais) {
           await criarAtividade({ idObra: codigo, dataAtividade: formatBR(new Date()), tipoContato: "observacao", status: "Realizado", proximoContato: "", comentario: detalhesOpcionais });
        }
        toast({ title: "Avançou para Negociação" });
      } else if (acao === "fechei") {
        await atualizarCampoObra(codigo, "statusProspeccao", "Fechado");
        await atualizarCampoObra(codigo, "statusDesde", formatBR(new Date()));
        if (detalhesOpcionais) {
           await criarAtividade({ idObra: codigo, dataAtividade: formatBR(new Date()), tipoContato: "observacao", status: "Realizado", proximoContato: "", comentario: detalhesOpcionais });
        }
        toast({ title: "Prospecção ganha (Fechado)!" });
      } else if (acao === "encerrar") {
        await atualizarCampoObra(codigo, "statusProspeccao", "Perdido");
        await atualizarCampoObra(codigo, "statusDesde", formatBR(new Date()));
        if (detalhesOpcionais) {
           await criarAtividade({ idObra: codigo, dataAtividade: formatBR(new Date()), tipoContato: "observacao", status: "Realizado", proximoContato: "", comentario: detalhesOpcionais });
        }
        toast({ title: "Prospecção encerrada (Perdido)" });
      }
      
      await carregar();
    } catch (e) {
      toast({ title: "Erro ao registrar ação", description: String(e), variant: "destructive" });
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

      await atualizarCampoObra(codigo, "proximoContato", formatBR(followDate));

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
            <div>
              <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                Prospecção
              </h1>
              <p className="text-sm text-muted-foreground">
                Acompanhe cada obra pelo clique — do primeiro contato ao fechamento.
              </p>
            </div>
          </div>
          <Button onClick={abrirNovaProspeccao}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Prospecção
          </Button>
        </div>



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
                                  if (o.construtora) {
                                    listarPessoas({ codigoConstrutora: o.construtora })
                                      .then(async (p) => {
                                        if (p && p.length > 0) {
                                          setPessoasModal(p);
                                        } else {
                                          const todas = await listarPessoas();
                                          setPessoasModal(todas ?? []);
                                        }
                                      })
                                      .catch(() => {});
                                  } else {
                                    listarPessoas().then((p) => setPessoasModal(p ?? []));
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
                              value={`${p.nome} ${p.cargo || ""} ${p.email || ""}`}
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

        {/* Filtros e Chips */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex flex-wrap gap-2 items-center">
              <Button
                variant={statusFiltro === "todos" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFiltro("todos")}
                className="rounded-full"
              >
                Todos ({obras.length})
              </Button>
              {Array.from(STATUS_PROSPECCAO_ATIVOS).map(status => {
                const count = obras.filter(o => normalizeText(o.statusProspeccao || "") === normalizeText(status)).length;
                return (
                  <Button
                    key={status}
                    variant={statusFiltro === status ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStatusFiltro(status as StatusFiltro)}
                    className="rounded-full"
                  >
                    {status} ({count})
                  </Button>
                );
              })}
            </div>

            <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
              <div className="relative flex-1 w-full max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar por obra, construtora, cidade, produto…"
                  className="pl-9"
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSortDesc(!sortDesc)}
                className="shrink-0"
              >
                Data de atualização {sortDesc ? <ChevronDown className="ml-2 h-4 w-4" /> : <ChevronUp className="ml-2 h-4 w-4" />}
              </Button>
            </div>
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
                        {o.statusDesde && (
                          <span className="text-[10px] text-muted-foreground ml-1">
                            desde {o.statusDesde}
                          </span>
                        )}
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
                          <DropdownMenuItem onClick={() => { setAcaoDialogDetalhes(""); setAcaoDialogOcorrencia({obra: o, acao: "iniciar", title: "Iniciar prospecção"}); setAcaoDialogDias(null); }}>
                            <ArrowRight className="h-4 w-4 mr-2 text-primary" />
                            Iniciar prospecção
                          </DropdownMenuItem>

                          <DropdownMenuItem onClick={() => { setAcaoDialogDetalhes(""); setAcaoDialogOcorrencia({obra: o, acao: "email", title: "Enviei e-mail"}); setAcaoDialogDias(configFollow.email); }}>
                            <CheckIcon className="h-4 w-4 mr-2 text-emerald-600" />
                            Enviei e-mail (Marcar)
                          </DropdownMenuItem>
                          
                          <DropdownMenuItem onClick={() => { setAcaoDialogDetalhes(""); setAcaoDialogOcorrencia({obra: o, acao: "whatsapp", title: "Enviei WhatsApp"}); setAcaoDialogDias(configFollow.whatsapp); }}>
                            <Phone className="h-4 w-4 mr-2 text-emerald-600" />
                            Enviei WhatsApp
                          </DropdownMenuItem>

                          <DropdownMenuItem onClick={() => { setAcaoDialogDetalhes(""); setAcaoDialogOcorrencia({obra: o, acao: "visitei", title: "Visitei a obra"}); setAcaoDialogDias(null); }}>
                            <MapPin className="h-4 w-4 mr-2 text-blue-600" />
                            Visitei a obra
                          </DropdownMenuItem>

                          <DropdownMenuItem onClick={() => { setAcaoDialogDetalhes(""); setAcaoDialogOcorrencia({obra: o, acao: "reuniao", title: "Fiz reunião"}); setAcaoDialogDias(null); }}>
                            <Users className="h-4 w-4 mr-2 text-indigo-600" />
                            Fiz reunião
                          </DropdownMenuItem>
                          
                          <DropdownMenuItem onClick={() => { setAcaoDialogDetalhes(""); setAcaoDialogOcorrencia({obra: o, acao: "respondeu", title: "Cliente respondeu!"}); setAcaoDialogDias(null); }}>
                            <Flame className="h-4 w-4 mr-2 text-orange-500" />
                            Cliente respondeu!
                          </DropdownMenuItem>
                          
                          <DropdownMenuItem onClick={() => { setAcaoDialogDetalhes(""); setAcaoDialogOcorrencia({obra: o, acao: "comecei_orcamento", title: "Comecei orçamento"}); setAcaoDialogDias(null); }}>
                            <Clock className="h-4 w-4 mr-2 text-teal-600" />
                            Comecei orçamento
                          </DropdownMenuItem>
                          
                          <DropdownMenuItem onClick={() => { setAcaoDialogDetalhes(""); setAcaoDialogOcorrencia({obra: o, acao: "orcamento", title: "Enviei Orçamento"}); setAcaoDialogDias(configFollow.orcamento); }}>
                            <CheckIcon className="h-4 w-4 mr-2 text-blue-600" />
                            Enviei Orçamento
                          </DropdownMenuItem>
                          
                          <DropdownMenuItem onClick={() => { setAcaoDialogDetalhes(""); setAcaoDialogOcorrencia({obra: o, acao: "avancar", title: "Avançar para Negociação"}); setAcaoDialogDias(null); }}>
                            <CheckIcon className="h-4 w-4 mr-2 text-muted-foreground" />
                            Avançar para Negociação
                          </DropdownMenuItem>

                          <DropdownMenuItem onClick={() => { setAcaoDialogDetalhes(""); setAcaoDialogOcorrencia({obra: o, acao: "fechei", title: "Fechei / Ganhei"}); setAcaoDialogDias(null); }}>
                            <Sparkles className="h-4 w-4 mr-2 text-emerald-600" />
                            Fechei / Ganhei
                          </DropdownMenuItem>
                          
                          <DropdownMenuItem onClick={() => { setAcaoDialogDetalhes(""); setAcaoDialogOcorrencia({obra: o, acao: "encerrar", title: "Encerrar / Perda"}); setAcaoDialogDias(null); }}>
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
        {/* Modal Ação (Detalhes Opcionais) */}
        <Dialog open={!!acaoDialogOcorrencia} onOpenChange={(o) => { if (!o) { setAcaoDialogOcorrencia(null); stopRecordingAndClear(); } }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Registrar: {acaoDialogOcorrencia?.title}</DialogTitle>
              <DialogDescription>
                Se desejar, adicione mais detalhes sobre essa ação.
              </DialogDescription>
            </DialogHeader>
            <div className="py-2 space-y-2">
              <Label>Detalhes (opcional)</Label>
              <div className="flex items-start gap-2">
                <Textarea
                  value={acaoDialogDetalhes}
                  onChange={(e) => {
                    const val = e.target.value;
                    setAcaoDialogDetalhes(val);
                    if (acaoDialogIsRecording) startingTextRef.current = val;
                  }}
                  placeholder="Ex: Falei com o João sobre o orçamento..."
                  className="resize-none"
                  rows={4}
                />
                <Button
                  type="button"
                  variant={acaoDialogIsRecording ? "destructive" : "outline"}
                  size="icon"
                  className="shrink-0"
                  onClick={toggleRecording}
                  disabled={!recognitionRef.current}
                  title={!recognitionRef.current ? "Ditado por voz não suportado neste navegador" : (acaoDialogIsRecording ? "Parar gravação" : "Falar")}
                >
                  {acaoDialogIsRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            {acaoDialogDias !== null && (
              <div className="py-2 space-y-2 border-t mt-2">
                <Label>Agendar próximo contato (dias)</Label>
                <div className="flex flex-wrap items-center gap-2">
                  {[5, 7, 10, 15, 30, 60].map(p => (
                    <Button
                      key={p}
                      type="button"
                      variant={acaoDialogDias === p ? "default" : "outline"}
                      size="sm"
                      onClick={() => setAcaoDialogDias(p)}
                      className="h-8 text-xs"
                    >
                      {p}
                    </Button>
                  ))}
                  <Input
                    type="number"
                    className="w-16 h-8 text-xs"
                    value={acaoDialogDias || ""}
                    onChange={e => setAcaoDialogDias(Number(e.target.value))}
                    min={1}
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => { setAcaoDialogOcorrencia(null); stopRecordingAndClear(); }}>
                Cancelar
              </Button>
              <Button
                onClick={() => {
                  stopRecordingAndClear();
                  if (acaoDialogOcorrencia) {
                    registrarAcaoManual(acaoDialogOcorrencia.obra, acaoDialogOcorrencia.acao, acaoDialogDetalhes.trim(), acaoDialogDias);
                    setAcaoDialogOcorrencia(null);
                  }
                }}
              >
                Confirmar
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
