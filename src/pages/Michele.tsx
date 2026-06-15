import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Sparkles, Loader2, Plus, MessageSquare, BookmarkPlus, X, Check, Zap, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type MemoriaTipo = "preferencia" | "cliente" | "correcao" | "geral";
type MemoriaSugerida = { tipo: MemoriaTipo; escopo: string; conteudo: string };
type AcaoTipo = "criar_followup" | "mudar_fase" | "atualizar_obra" | string;
type AcaoSugerida = { tipo: AcaoTipo; dados: Record<string, unknown> };

const MEMORIA_RE = /\[MEMORIA\]([\s\S]*?)\[\/MEMORIA\]/i;
const ACAO_RE = /\[ACAO\]([\s\S]*?)\[\/ACAO\]/i;
const ACOES_DISPONIVEIS = new Set(["criar_followup", "mudar_fase", "atualizar_obra"]);

function parseMemoria(content: string): { texto: string; memoria: MemoriaSugerida | null } {
  const m = content.match(MEMORIA_RE);
  if (!m) return { texto: content, memoria: null };
  const bloco = m[1];
  const get = (k: string) => {
    const r = new RegExp(`${k}\\s*:\\s*(.+)`, "i").exec(bloco);
    return r ? r[1].trim().replace(/^['"]|['"]$/g, "") : "";
  };
  const tipoRaw = get("tipo").toLowerCase() as MemoriaTipo;
  const tipo: MemoriaTipo = ["preferencia", "cliente", "correcao", "geral"].includes(tipoRaw)
    ? tipoRaw
    : "geral";
  const escopo = get("escopo") || "global";
  const conteudo = get("conteudo");
  const texto = content.replace(MEMORIA_RE, "").trim();
  if (!conteudo) return { texto: content, memoria: null };
  return { texto, memoria: { tipo, escopo, conteudo } };
}

function parseAcao(content: string): { texto: string; acao: AcaoSugerida | null } {
  const m = content.match(ACAO_RE);
  if (!m) return { texto: content, acao: null };
  const bloco = m[1];
  const tipoMatch = /tipo\s*:\s*(.+)/i.exec(bloco);
  const dadosMatch = /dados\s*:\s*([\s\S]+)/i.exec(bloco);
  const tipo = tipoMatch ? tipoMatch[1].trim() : "";
  let dados: Record<string, unknown> = {};
  if (dadosMatch) {
    const raw = dadosMatch[1].trim();
    try {
      dados = JSON.parse(raw);
    } catch {
      // try extracting just the JSON object
      const jm = raw.match(/\{[\s\S]*\}/);
      if (jm) {
        try { dados = JSON.parse(jm[0]); } catch { dados = {}; }
      }
    }
  }
  const texto = content.replace(ACAO_RE, "").trim();
  if (!tipo) return { texto: content, acao: null };
  return { texto, acao: { tipo, dados } };
}

const ACAO_LABEL: Record<string, string> = {
  criar_followup: "Criar follow-up",
  mudar_fase: "Mudar fase da obra",
  atualizar_obra: "Atualizar dados da obra",
};



type AcaoStatus = "pendente" | "aprovada" | "cancelada" | null;
type MemoriaStatus = "pendente" | "guardada" | "descartada" | null;
type Message = {
  id?: string;
  role: "user" | "assistant";
  content: string;
  acao_status?: AcaoStatus;
  acao_dados?: { tipo: string; dados: Record<string, unknown> } | null;
  memoria_status?: MemoriaStatus;
  memoria_dados?: MemoriaSugerida | null;
};
type Conversa = { id: string; titulo: string; updated_at: string };

const ACTIVE_KEY = "michele:active-conversa";

function makeTitulo(text: string) {
  const t = text.trim().replace(/\s+/g, " ");
  return t.length > 40 ? t.slice(0, 40) + "…" : t || "Nova conversa";
}

export default function Michele() {
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [activeId]);

  const loadConversas = useCallback(async () => {
    const { data, error } = await supabase
      .from("conversas_michele")
      .select("id,titulo,updated_at")
      .order("updated_at", { ascending: false });
    if (error) {
      console.error(error);
      return [] as Conversa[];
    }
    const list = (data ?? []) as Conversa[];
    setConversas(list);
    return list;
  }, []);

  const loadMessages = useCallback(async (conversaId: string) => {
    const { data, error } = await supabase
      .from("mensagens_michele")
      .select("id,role,content,acao_status,acao_dados,memoria_status,memoria_dados")
      .eq("conversa_id", conversaId)
      .order("created_at", { ascending: true });
    if (error) {
      console.error(error);
      setMessages([]);
      return;
    }
    setMessages((data ?? []) as unknown as Message[]);
  }, []);

  // Initial load: list + restore last active conversation
  useEffect(() => {
    (async () => {
      const list = await loadConversas();
      const stored = typeof window !== "undefined" ? localStorage.getItem(ACTIVE_KEY) : null;
      const pick = stored && list.find((c) => c.id === stored) ? stored : list[0]?.id ?? null;
      if (pick) {
        setActiveId(pick);
        await loadMessages(pick);
      }
    })();
  }, [loadConversas, loadMessages]);

  function selectConversa(id: string) {
    if (id === activeId) return;
    setActiveId(id);
    localStorage.setItem(ACTIVE_KEY, id);
    loadMessages(id);
  }

  function novaConversa() {
    setActiveId(null);
    setMessages([]);
    localStorage.removeItem(ACTIVE_KEY);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;

    setLoading(true);
    const userMsg: Message = { role: "user", content: text };
    const next: Message[] = [...messages, userMsg];
    setMessages(next);
    setInput("");

    try {
      // Ensure a conversation exists
      let conversaId = activeId;
      if (!conversaId) {
        const { data: conv, error: convErr } = await supabase
          .from("conversas_michele")
          .insert({ titulo: makeTitulo(text) })
          .select("id,titulo,updated_at")
          .single();
        if (convErr || !conv) throw convErr ?? new Error("Falha ao criar conversa");
        conversaId = conv.id;
        setActiveId(conversaId);
        localStorage.setItem(ACTIVE_KEY, conversaId);
        setConversas((prev) => [conv as Conversa, ...prev]);
      }

      // Persist user message
      const { error: insUserErr } = await supabase
        .from("mensagens_michele")
        .insert({ conversa_id: conversaId, role: "user", content: text });
      if (insUserErr) console.error(insUserErr);

      // Call Michele
      const { data, error } = await supabase.functions.invoke("michele-chat", {
        body: { messages: next },
      });
      if (error) throw error;
      const reply = (data as { text?: string; error?: string })?.text;
      if (!reply) {
        const errMsg = (data as { error?: string })?.error ?? "Sem resposta da Michele.";
        toast.error(errMsg);
        return;
      }
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);

      // Parse acao/memoria from reply and persist with status
      const { memoria } = parseMemoria(reply);
      const { acao } = parseAcao(reply);
      const acao_status = acao ? "pendente" : null;
      const acao_dados = acao ? { tipo: acao.tipo, dados: acao.dados } : null;
      const memoria_status = memoria ? "pendente" : null;
      const memoria_dados = memoria ?? null;

      const { data: insAss } = await supabase
        .from("mensagens_michele")
        .insert({
          conversa_id: conversaId,
          role: "assistant",
          content: reply,
          acao_status,
          acao_dados: acao_dados as unknown as never,
          memoria_status,
          memoria_dados: memoria_dados as unknown as never,
        })
        .select("id")
        .single();

      if (insAss?.id) {
        setMessages((prev) => {
          const copy = [...prev];
          for (let i = copy.length - 1; i >= 0; i--) {
            if (copy[i].role === "assistant" && !copy[i].id) {
              copy[i] = {
                ...copy[i],
                id: insAss.id,
                acao_status,
                acao_dados,
                memoria_status,
                memoria_dados,
              };
              break;
            }
          }
          return copy;
        });
      }

      await supabase
        .from("conversas_michele")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", conversaId);
      loadConversas();
    } catch (e) {
      console.error(e);
      toast.error("Erro ao falar com a Michele. Tente novamente.");
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex gap-4 h-[calc(100vh-8rem)] max-w-6xl mx-auto">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 hidden md:flex flex-col border rounded-lg bg-card">
        <div className="p-3 border-b">
          <Button onClick={novaConversa} className="w-full" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Nova conversa
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {conversas.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4 px-2">
              Nenhuma conversa ainda.
            </p>
          )}
          {conversas.map((c) => (
            <button
              key={c.id}
              onClick={() => selectConversa(c.id)}
              className={`w-full text-left text-sm px-3 py-2 rounded-md flex items-start gap-2 transition-colors ${
                c.id === activeId
                  ? "bg-primary/10 text-foreground"
                  : "hover:bg-muted text-muted-foreground"
              }`}
            >
              <MessageSquare className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span className="truncate">{c.titulo}</span>
            </button>
          ))}
        </div>
      </aside>

      {/* Chat */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                Michele
              </h1>
              <p className="text-sm text-muted-foreground">
                Assistente de prospecção · Gal Representações
              </p>
            </div>
          </div>
          <Button onClick={novaConversa} variant="outline" size="sm" className="md:hidden">
            <Plus className="h-4 w-4 mr-1" />
            Nova
          </Button>
        </div>

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto rounded-lg border bg-card p-4 space-y-3"
        >
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground text-sm py-12">
              Comece a conversa com a Michele.
            </div>
          )}
          {messages.map((m, i) => {
            if (m.role === "user") {
              return (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[80%] rounded-2xl px-4 py-2 whitespace-pre-wrap text-sm bg-primary text-primary-foreground">
                    {m.content}
                  </div>
                </div>
              );
            }
            const { texto: t1, memoria: memParsed } = parseMemoria(m.content);
            const { texto, acao: acaoParsed } = parseAcao(t1);
            // Prefer persisted dados over parsed
            const memoria = m.memoria_dados ?? memParsed;
            const acao = m.acao_dados ?? acaoParsed;
            return (
              <div key={m.id ?? i} className="flex justify-start">
                <div className="max-w-[80%] space-y-2">
                  {texto && (
                    <div className="rounded-2xl px-4 py-2 whitespace-pre-wrap text-sm bg-muted text-foreground">
                      {texto}
                    </div>
                  )}
                  {memoria && (
                    <MemoriaCard
                      messageId={m.id}
                      memoria={memoria as MemoriaSugerida}
                      initialStatus={(m.memoria_status ?? "pendente") as Exclude<MemoriaStatus, null>}
                    />
                  )}
                  {acao && (
                    <AcaoCard
                      messageId={m.id}
                      acao={acao as AcaoSugerida}
                      initialStatus={(m.acao_status ?? "pendente") as Exclude<AcaoStatus, null>}
                    />
                  )}
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-2xl px-4 py-2 text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                Michele está pensando…
              </div>
            </div>
          )}
        </div>

        <div className="mt-3 flex gap-2 items-end">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escreva uma mensagem para a Michele…"
            rows={2}
            className="resize-none"
            disabled={loading}
          />
          <Button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            size="icon"
            className="h-[60px] w-[60px]"
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function MemoriaCard({
  memoria,
  messageId,
  initialStatus,
}: {
  memoria: MemoriaSugerida;
  messageId?: string;
  initialStatus: "pendente" | "guardada" | "descartada";
}) {
  const [estado, setEstado] = useState<"pendente" | "guardada" | "descartada">(initialStatus);
  const [saving, setSaving] = useState(false);

  if (estado === "descartada") return null;

  if (estado === "guardada") {
    return (
      <div className="rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
        <Check className="h-3.5 w-3.5 text-primary" />
        📌 Guardado
      </div>
    );
  }

  async function updateStatus(novo: "guardada" | "descartada") {
    if (!messageId) return;
    await supabase
      .from("mensagens_michele")
      .update({ memoria_status: novo })
      .eq("id", messageId);
  }

  async function handleGuardar() {
    setSaving(true);
    const { error } = await supabase.from("memoria_michele").insert({
      tipo: memoria.tipo,
      escopo: memoria.escopo || "global",
      conteudo: memoria.conteudo,
    });
    setSaving(false);
    if (error) {
      console.error(error);
      toast.error("Não consegui guardar agora.");
      return;
    }
    await updateStatus("guardada");
    setEstado("guardada");
  }

  async function handleDescartar() {
    await updateStatus("descartada");
    setEstado("descartada");
  }

  return (
    <div className="rounded-xl border border-primary/40 bg-primary/5 p-3 space-y-2">
      <div className="flex items-start gap-2">
        <BookmarkPlus className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <div className="text-xs space-y-1">
          <div className="text-muted-foreground">
            <span className="font-medium text-foreground">{memoria.tipo}</span>
            {" · "}
            <span>{memoria.escopo}</span>
          </div>
          <p className="text-sm text-foreground">{memoria.conteudo}</p>
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDescartar}
          disabled={saving}
        >
          <X className="h-3.5 w-3.5 mr-1" />
          Descartar
        </Button>
        <Button size="sm" onClick={handleGuardar} disabled={saving}>
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
          ) : (
            <BookmarkPlus className="h-3.5 w-3.5 mr-1" />
          )}
          Guardar na memória
        </Button>
      </div>
    </div>
  );
}

function formatarDados(tipo: string, dados: Record<string, unknown>): { label: string; value: string }[] {
  const entries: { label: string; value: string }[] = [];
  const push = (label: string, key: string) => {
    const v = dados[key];
    if (v !== undefined && v !== null && String(v).trim() !== "") {
      entries.push({ label, value: String(v) });
    }
  };
  if (dados.codigoObra) entries.push({ label: "Obra", value: String(dados.codigoObra) });
  if (tipo === "criar_followup") {
    push("Descrição", "descricao");
    push("Data", "data_prevista");
    push("Tipo", "tipo");
    push("Canal", "canal_sugerido");
    push("Prioridade", "prioridade");
    push("Responsável", "responsavel");
  } else if (tipo === "mudar_fase") {
    push("Nova fase", "fase_michele");
    push("Temperatura", "temperatura");
  } else {
    for (const [k, v] of Object.entries(dados)) {
      if (k === "codigoObra") continue;
      if (v === undefined || v === null || String(v).trim() === "") continue;
      entries.push({ label: k, value: typeof v === "object" ? JSON.stringify(v) : String(v) });
    }
  }
  return entries;
}

function AcaoCard({ acao }: { acao: AcaoSugerida }) {
  const [estado, setEstado] = useState<"pendente" | "executando" | "executado" | "cancelado" | "erro">("pendente");
  const [resumo, setResumo] = useState<string>("");
  const [erro, setErro] = useState<string>("");
  const disponivel = ACOES_DISPONIVEIS.has(acao.tipo);
  const label = ACAO_LABEL[acao.tipo] ?? acao.tipo;
  const entries = formatarDados(acao.tipo, acao.dados);

  if (estado === "cancelado") return null;

  async function handleExecutar() {
    setEstado("executando");
    setErro("");
    try {
      const { data, error } = await supabase.functions.invoke("michele-executar-acao", {
        body: { tipo: acao.tipo, dados: acao.dados },
      });
      if (error) throw error;
      const r = data as { ok?: boolean; resumo?: string; error?: string };
      if (!r?.ok) {
        setErro(r?.error ?? "Não foi possível executar.");
        setEstado("erro");
        return;
      }
      setResumo(r.resumo ?? "Ação executada.");
      setEstado("executado");
      toast.success("Feito! ✅");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErro(msg);
      setEstado("erro");
      toast.error("Erro ao executar a ação.");
    }
  }

  return (
    <div className="rounded-xl border-2 border-amber-500/50 bg-amber-500/5 p-3 space-y-3">
      <div className="flex items-start gap-2">
        <Zap className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide">
            Ação proposta
          </div>
          <div className="text-sm font-medium text-foreground">{label}</div>
          {!disponivel && (
            <div className="mt-1 flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-3 w-3" />
              Ação ainda não disponível.
            </div>
          )}
        </div>
      </div>

      {entries.length > 0 && (
        <dl className="text-xs space-y-1 pl-6">
          {entries.map((e) => (
            <div key={e.label} className="flex gap-2">
              <dt className="text-muted-foreground min-w-[80px]">{e.label}:</dt>
              <dd className="text-foreground break-words flex-1">{e.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {estado === "executado" && (
        <div className="rounded-md bg-primary/10 px-3 py-2 text-xs text-foreground flex items-start gap-2">
          <Check className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
          <div>
            <div className="font-medium">Feito! ✅</div>
            {resumo && <div className="text-muted-foreground mt-0.5">{resumo}</div>}
          </div>
        </div>
      )}

      {estado === "erro" && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {erro || "Erro ao executar."}
        </div>
      )}

      {(estado === "pendente" || estado === "executando" || estado === "erro") && (
        <div className="flex gap-2 justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEstado("cancelado")}
            disabled={estado === "executando"}
          >
            <X className="h-3.5 w-3.5 mr-1" />
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={handleExecutar}
            disabled={!disponivel || estado === "executando"}
          >
            {estado === "executando" ? (
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            ) : (
              <Zap className="h-3.5 w-3.5 mr-1" />
            )}
            {estado === "erro" ? "Tentar novamente" : "Aprovar e executar"}
          </Button>
        </div>
      )}
    </div>
  );
}


