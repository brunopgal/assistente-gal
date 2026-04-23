import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bot, Send, Loader2, X, MessageCircle, Mic, Square, Paperclip, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { mapFieldsToForm, type SecretariaAction } from "@/lib/secretariaFields";
import { atualizarObra, criarObra, buscarObra, type Obra } from "@/services/obrasService";
import { supabase } from "@/integrations/supabase/client";

interface AttachedFile {
  name: string;
  url: string;
}

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

const DICAS_STORAGE_KEY = "secretaria_dicas";

function loadDicas(): string[] {
  try {
    const raw = localStorage.getItem(DICAS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function saveDicas(dicas: string[]) {
  localStorage.setItem(DICAS_STORAGE_KEY, JSON.stringify(dicas));
}

export default function SecretariaChat() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      role: "assistant",
      content:
        "Olá! Sou sua Secretária de Obras. Posso criar, editar ou atualizar obras pra você. O que precisa?",
    },
  ]);
  const navigate = useNavigate();
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const blobToBase64 = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1] || "");
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        if (blob.size === 0) return;
        setTranscribing(true);
        try {
          const base64 = await blobToBase64(blob);
          const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe`;
          const res = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({ audio: base64, mime: "audio/webm" }),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || `Erro ${res.status}`);
          }
          const { text } = (await res.json()) as { text: string };
          if (text) {
            setInput((prev) => (prev ? `${prev} ${text}` : text));
          } else {
            toast({ title: "Áudio vazio", description: "Não consegui transcrever." });
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Erro na transcrição";
          toast({ title: "Erro", description: msg, variant: "destructive" });
        } finally {
          setTranscribing(false);
        }
      };
      mr.start();
      recorderRef.current = mr;
      setRecording(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Não foi possível acessar o microfone";
      toast({ title: "Microfone bloqueado", description: msg, variant: "destructive" });
    }
  };

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    setRecording(false);
  };

  const toggleRecording = () => {
    if (recording) stopRecording();
    else startRecording();
  };

  const normalizeObraId = (raw?: string): string | undefined => {
    if (!raw) return undefined;
    const cleaned = raw.trim().toUpperCase();
    // Already canonical
    const canonical = cleaned.match(/^OBRA(\d{1,9})$/);
    if (canonical) return `OBRA${canonical[1].padStart(9, "0")}`;
    // Words to numbers (PT-BR, 1-30)
    const words: Record<string, number> = {
      UM: 1, UMA: 1, DOIS: 2, DUAS: 2, TRES: 3, "TRÊS": 3, QUATRO: 4, CINCO: 5,
      SEIS: 6, SETE: 7, OITO: 8, NOVE: 9, DEZ: 10, ONZE: 11, DOZE: 12, TREZE: 13,
      QUATORZE: 14, CATORZE: 14, QUINZE: 15, DEZESSEIS: 16, DEZESSETE: 17,
      DEZOITO: 18, DEZENOVE: 19, VINTE: 20, TRINTA: 30,
    };
    // Find any number (digits or word) after "OBRA"
    const m = cleaned.match(/OBRA\s*N?º?\.?\s*([A-Z]+|\d+)/);
    if (m) {
      const token = m[1];
      const num = /^\d+$/.test(token) ? parseInt(token, 10) : words[token];
      if (num && num > 0) return `OBRA${String(num).padStart(9, "0")}`;
    }
    // Loose: any digits at all
    const digits = cleaned.match(/\d+/);
    if (digits && cleaned.includes("OBRA")) {
      return `OBRA${digits[0].padStart(9, "0")}`;
    }
    return raw;
  };

  const applyAction = (action: SecretariaAction) => {
    if (action.modo === "editar" && action.id) {
      const normalizedId = normalizeObraId(action.id) || action.id;
      const formFields = mapFieldsToForm(action.campos);
      sessionStorage.setItem(
        "secretaria_prefill",
        JSON.stringify({ mode: "editar", id: normalizedId, fields: formFields }),
      );
      navigate(`/nova-obra?id=${encodeURIComponent(normalizedId)}`);
      toast({ title: "Abrindo obra", description: normalizedId });
    } else if (action.modo === "nova") {
      const formFields = mapFieldsToForm(action.campos);
      sessionStorage.setItem(
        "secretaria_prefill",
        JSON.stringify({ mode: "nova", fields: formFields }),
      );
      navigate(`/nova-obra`);
      toast({ title: "Nova obra", description: "Formulário pré-preenchido" });
    }
  };

  // Saves directly to the sheet without opening the form
  const executarAcao = async (action: SecretariaAction): Promise<string> => {
    const formFields = mapFieldsToForm(action.campos) as Partial<Obra>;

    if (action.criar) {
      // Create new obra directly
      const today = new Date().toISOString().slice(0, 10);
      const novaObra: Obra = {
        dataCadastro: today,
        statusProspeccao: "",
        nome: "",
        classificacao: "",
        construtora: "",
        responsavel: "",
        telefone: "",
        email: "",
        cidade: "",
        localizacao: "",
        produtoOferecido: "",
        estagioObra: "",
        marcouReuniao: "",
        visita: "",
        dataUltimaVisita: "",
        dataOrcamentoEnviado: "",
        proximoContato: "",
        linkOrcamentoRhoden: "",
        linkOrcamentoPrado: "",
        linkOrcamentoImab: "",
        observacoes: "",
        concorrentes: "",
        ...formFields,
      };
      const created = await criarObra(novaObra);
      return `✅ Obra criada (${created.id || created.codigoObra}).`;
    }

    if (!action.id) throw new Error("ID da obra não informado para atualização direta.");
    const normalizedId = normalizeObraId(action.id) || action.id;

    // Merge with existing values so we don't blank out other columns
    const existing = await buscarObra(normalizedId);
    const merged: Obra = { ...existing, ...formFields, codigoObra: normalizedId } as Obra;
    await atualizarObra(normalizedId, merged);
    return `✅ Obra ${normalizedId} atualizada.`;
  };

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const next: ChatMsg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);

    try {
      const dicas = loadDicas();
      const dicasMsg: ChatMsg[] = dicas.length
        ? [
            {
              role: "assistant",
              content: `DICAS_USUARIO (regras permanentes a seguir):\n- ${dicas.join("\n- ")}`,
            },
          ]
        : [];

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/secretaria`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [...dicasMsg, ...next].map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Erro ${res.status}`);
      }

      const { action } = (await res.json()) as { action: SecretariaAction };
      let reply = action.mensagem || "Pronto.";

      // Handle dicas memory
      if (action.salvarDica) {
        const current = loadDicas();
        if (!current.includes(action.salvarDica)) {
          current.push(action.salvarDica);
          saveDicas(current);
        }
      }
      if (action.limparDicas) {
        saveDicas([]);
      }

      if (action.modo === "executar") {
        try {
          const result = await executarAcao(action);
          reply = `${reply}\n${result}`.trim();
          toast({ title: "Salvo direto", description: result });
        } catch (e) {
          const m = e instanceof Error ? e.message : "Falha ao salvar";
          reply = `${reply}\n⚠️ ${m}`.trim();
          toast({ title: "Erro ao salvar", description: m, variant: "destructive" });
        }
      }

      setMessages((m) => [...m, { role: "assistant", content: reply }]);

      if (action.modo === "nova" || action.modo === "editar") {
        applyAction(action);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao falar com a Secretária";
      setMessages((m) => [...m, { role: "assistant", content: `⚠️ ${msg}` }]);
      toast({ title: "Erro", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-xl hover:scale-105 transition flex items-center justify-center"
        aria-label="Abrir Secretária"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-[min(380px,calc(100vw-3rem))] h-[min(560px,calc(100vh-8rem))] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/40">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">Secretária de Obras</p>
              <p className="text-xs text-muted-foreground">Ajuda comercial inteligente</p>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-muted text-foreground rounded-bl-sm"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl px-3 py-2 text-sm flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" /> pensando…
                </div>
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="p-3 border-t border-border flex gap-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                transcribing
                  ? "Transcrevendo áudio…"
                  : recording
                    ? "Gravando… toque no quadrado para parar"
                    : "Ex: Crie obra Aurora em Campinas"
              }
              disabled={loading || transcribing}
            />
            <Button
              type="button"
              size="icon"
              variant={recording ? "destructive" : "outline"}
              onClick={toggleRecording}
              disabled={loading || transcribing}
              aria-label={recording ? "Parar gravação" : "Gravar áudio"}
            >
              {transcribing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : recording ? (
                <Square className="h-4 w-4" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </Button>
            <Button type="submit" size="icon" disabled={loading || transcribing || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      )}
    </>
  );
}
