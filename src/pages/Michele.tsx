import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Sparkles, Loader2, Plus, MessageSquare, BookmarkPlus, X, Check, Zap, AlertTriangle, Paperclip } from "lucide-react";
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
const PLANO_RE = /\[PLANO\]([\s\S]*?)\[\/PLANO\]/i;
const ACOES_DISPONIVEIS = new Set(["criar_followup", "mudar_fase", "atualizar_obra", "cadastrar_obra", "cadastrar_construtora", "cadastrar_contato", "atualizar_contato", "cadastrar_obras_lote"]);

type PlanoAcao = { tipo: string; dados: Record<string, unknown> };
type PlanoSugerido = { titulo: string; acoes: PlanoAcao[] };

function parsePlano(content: string): { texto: string; plano: PlanoSugerido | null } {
  const m = content.match(PLANO_RE);
  if (!m) return { texto: content, plano: null };
  const bloco = m[1];
  const tituloMatch = /titulo\s*:\s*(.+)/i.exec(bloco);
  const acoesMatch = /acoes\s*:\s*([\s\S]+)/i.exec(bloco);
  const titulo = tituloMatch ? tituloMatch[1].trim().replace(/^['"]|['"]$/g, "") : "Plano";
  let acoes: PlanoAcao[] = [];
  if (acoesMatch) {
    const raw = acoesMatch[1].trim();
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) acoes = parsed;
    } catch {
      const jm = raw.match(/\[[\s\S]*\]/);
      if (jm) {
        try {
          const parsed = JSON.parse(jm[0]);
          if (Array.isArray(parsed)) acoes = parsed;
        } catch { /* ignore */ }
      }
    }
  }
  const texto = content.replace(PLANO_RE, "").trim();
  if (acoes.length === 0) return { texto: content, plano: null };
  return { texto, plano: { titulo, acoes } };
}


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
  cadastrar_obra: "Cadastrar nova obra",
  cadastrar_construtora: "Cadastrar nova construtora",
  cadastrar_contato: "Cadastrar novo contato",
  atualizar_contato: "Atualizar contato",
  cadastrar_obras_lote: "Cadastrar obras em lote",
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
  imagem_url?: string | null;
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
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [planilha, setPlanilha] = useState<{ name: string; base64: string } | null>(null);
  const [documento, setDocumento] = useState<{ name: string; base64: string; mime: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const isImage = /^image\/(jpeg|png|gif|webp)$/.test(f.type);
    const nameLower = f.name.toLowerCase();
    const isSheet = /\.(xlsx|xls|csv)$/.test(nameLower) ||
      /spreadsheet|excel|csv/.test(f.type);
    const isDoc = /\.(pdf|txt|md|docx|doc)$/.test(nameLower) ||
      /^application\/pdf$/.test(f.type) ||
      /^text\//.test(f.type) ||
      /wordprocessingml|msword/.test(f.type);
    if (!isImage && !isSheet && !isDoc) {
      toast.error("Envie imagem, planilha (.xlsx/.xls/.csv) ou documento (.pdf/.txt/.md/.docx).");
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      toast.error("Arquivo muito grande (máx 10MB).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      const b64 = result.includes(",") ? result.split(",")[1] : result;
      if (isImage) {
        setImageDataUrl(result);
        setPlanilha(null);
        setDocumento(null);
      } else if (isSheet) {
        setPlanilha({ name: f.name, base64: b64 });
        setImageDataUrl(null);
        setDocumento(null);
      } else {
        const mime = f.type || (nameLower.endsWith(".pdf") ? "application/pdf"
          : nameLower.endsWith(".docx") ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          : nameLower.endsWith(".doc") ? "application/msword"
          : "text/plain");
        setDocumento({ name: f.name, base64: b64, mime });
        setImageDataUrl(null);
        setPlanilha(null);
      }
    };
    reader.readAsDataURL(f);
  }

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
      .select("id,role,content,acao_status,acao_dados,memoria_status,memoria_dados,imagem_url")
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

  async function uploadImagem(dataUrl: string): Promise<string | null> {
    try {
      const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
      if (!m) return null;
      const mime = m[1];
      const b64 = m[2];
      const ext = mime.split("/")[1] || "png";
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: mime });
      const { data: u } = await supabase.auth.getUser();
      const userId = u?.user?.id ?? "anon";
      const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage
        .from("michele-uploads")
        .upload(path, blob, { contentType: mime, upsert: false });
      if (error) {
        console.error("upload error", error);
        return null;
      }
      return path;
    } catch (e) {
      console.error("uploadImagem", e);
      return null;
    }
  }

  async function handleSend() {
    const text = input.trim();
    if ((!text && !imageDataUrl && !planilha && !documento) || loading) return;

    setLoading(true);
    const currentPlanilha = planilha;
    const currentDocumento = documento;
    const userText = text
      || (currentPlanilha ? `[planilha: ${currentPlanilha.name}]`
      : (currentDocumento ? `[documento: ${currentDocumento.name}]`
      : (imageDataUrl ? "[imagem anexa]" : "")));
    const currentImage = imageDataUrl;
    setInput("");
    setImageDataUrl(null);
    setPlanilha(null);
    setDocumento(null);

    // Upload da imagem (se houver) antes de pintar a mensagem
    let imagemPath: string | null = null;
    if (currentImage) {
      imagemPath = await uploadImagem(currentImage);
      if (!imagemPath) toast.error("Não consegui salvar a imagem (segui sem ela).");
    }

    const userMsg: Message = { role: "user", content: userText, imagem_url: imagemPath };
    const next: Message[] = [...messages, userMsg];
    setMessages(next);

    try {
      // Ensure a conversation exists
      let conversaId = activeId;
      if (!conversaId) {
        const { data: conv, error: convErr } = await supabase
          .from("conversas_michele")
          .insert({ titulo: makeTitulo(userText) })
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
        .insert({
          conversa_id: conversaId,
          role: "user",
          content: userText,
          imagem_url: imagemPath,
        });
      if (insUserErr) console.error(insUserErr);

      // Branch: planilha → importar; senão → chat normal (com doc opcional)
      let reply: string | undefined;
      if (currentPlanilha) {
        const { data, error } = await supabase.functions.invoke("michele-importar-planilha", {
          body: { base64: currentPlanilha.base64, filename: currentPlanilha.name },
        });
        if (error) throw error;
        reply = (data as { text?: string; error?: string })?.text;
        if (!reply) {
          toast.error((data as { error?: string })?.error ?? "Falha ao importar planilha.");
          return;
        }
      } else {
        const { data, error } = await supabase.functions.invoke("michele-chat", {
          body: {
            messages: next,
            image: currentImage,
            documento: currentDocumento
              ? { name: currentDocumento.name, base64: currentDocumento.base64, mime: currentDocumento.mime }
              : undefined,
          },
        });
        if (error) throw error;
        reply = (data as { text?: string; error?: string })?.text;
        if (!reply) {
          toast.error((data as { error?: string })?.error ?? "Sem resposta da Michele.");
          return;
        }
      }
      setMessages((prev) => [...prev, { role: "assistant", content: reply! }]);

      // Parse plano/acao/memoria from reply and persist with status
      const replyText = reply!;
      const { memoria } = parseMemoria(replyText);
      const { plano } = parsePlano(replyText);
      const { acao } = plano ? { acao: null as null } : parseAcao(replyText);
      const acao_status = plano || acao ? "pendente" : null;
      const acao_dados = plano
        ? { tipo: "plano", dados: { titulo: plano.titulo, acoes: plano.acoes } }
        : acao ? { tipo: acao.tipo, dados: acao.dados } : null;
      const memoria_status = memoria ? "pendente" : null;
      const memoria_dados = memoria ?? null;


      const { data: insAss } = await supabase
        .from("mensagens_michele")
        .insert({
          conversa_id: conversaId,
          role: "assistant",
          content: replyText,
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
                <div key={m.id ?? i} className="flex justify-end">
                  <div className="max-w-[80%] space-y-2">
                    {m.imagem_url && <ChatImage path={m.imagem_url} />}
                    {m.content && m.content !== "[imagem anexa]" && (
                      <div className="rounded-2xl px-4 py-2 whitespace-pre-wrap text-sm bg-primary text-primary-foreground">
                        {m.content}
                      </div>
                    )}
                  </div>
                </div>
              );
            }
            const { texto: t1, memoria: memParsed } = parseMemoria(m.content);
            const { texto: t2, plano: planoParsed } = parsePlano(t1);
            const { texto, acao: acaoParsed } = planoParsed
              ? { texto: t2, acao: null as null }
              : parseAcao(t2);
            // Prefer persisted dados over parsed
            const memoria = m.memoria_dados ?? memParsed;
            const persistedIsPlano = m.acao_dados && (m.acao_dados as any).tipo === "plano";
            const plano = persistedIsPlano
              ? ((m.acao_dados as any).dados as { titulo: string; acoes: PlanoAcao[]; resultado?: any })
              : planoParsed;
            const acao = !persistedIsPlano && m.acao_dados ? m.acao_dados : acaoParsed;
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
                  {plano && (
                    <PlanoCard
                      messageId={m.id}
                      plano={plano as PlanoSugerido & { resultado?: any }}
                      initialStatus={(m.acao_status ?? "pendente") as Exclude<AcaoStatus, null>}
                    />
                  )}
                  {!plano && acao && (
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

        {imageDataUrl && (
          <div className="mt-3 flex items-center gap-2 rounded-md border bg-muted/40 p-2">
            <img src={imageDataUrl} alt="anexo" className="h-16 w-16 rounded object-cover" />
            <span className="text-xs text-muted-foreground flex-1">Imagem pronta para enviar</span>
            <Button variant="ghost" size="sm" onClick={() => setImageDataUrl(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
        {planilha && (
          <div className="mt-3 flex items-center gap-2 rounded-md border bg-muted/40 p-2">
            <Paperclip className="h-5 w-5 text-primary" />
            <span className="text-xs text-foreground flex-1 truncate">
              📊 Planilha: <strong>{planilha.name}</strong> — vou ler e organizar.
            </span>
            <Button variant="ghost" size="sm" onClick={() => setPlanilha(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
        {documento && (
          <div className="mt-3 flex items-center gap-2 rounded-md border bg-muted/40 p-2">
            <Paperclip className="h-5 w-5 text-primary" />
            <span className="text-xs text-foreground flex-1 truncate">
              📄 Documento: <strong>{documento.name}</strong>
            </span>
            <Button variant="ghost" size="sm" onClick={() => setDocumento(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
        <div className="mt-3 flex gap-2 items-end">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp,.xlsx,.xls,.csv,.pdf,.txt,.md,.docx,.doc,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
            className="hidden"
            onChange={handleFile}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-[60px] w-[60px] shrink-0"
            disabled={loading}
            onClick={() => fileInputRef.current?.click()}
            title="Anexar imagem, planilha ou documento (PDF, TXT, DOCX)"
          >
            <Paperclip className="h-5 w-5" />
          </Button>
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
            disabled={loading || (!input.trim() && !imageDataUrl && !planilha && !documento)}
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
  } else if (tipo === "cadastrar_obra") {
    push("Nome", "nome");
    push("Construtora", "construtora");
    push("Cidade", "cidade");
    push("Endereço", "localizacao");
    push("Estágio", "estagioObra");
    push("Produto", "produtoOferecido");
    push("Responsável", "responsavel");
    push("Telefone", "telefone");
    push("Email", "email");
    push("Observações", "observacoes");
  } else if (tipo === "cadastrar_construtora") {
    push("Nome", "nome");
    push("CNPJ", "cnpj");
    push("Produto", "produto");
    push("Status", "status");
    push("Observações", "observacoes");
  } else if (tipo === "cadastrar_contato") {
    push("Nome", "nome");
    push("Cargo", "cargo");
    push("WhatsApp", "whatsapp");
    push("Email", "email");
    push("Construtora", "codigoConstrutora");
    push("Obra atual", "codigoObraAtual");
    push("Observações", "observacoes");
  } else if (tipo === "atualizar_contato") {
    push("Contato", "codigoPessoa");
    push("Nome", "nome");
    push("Cargo", "cargo");
    push("WhatsApp", "whatsapp");
    push("Email", "email");
    push("Construtora", "codigoConstrutora");
    push("Obra atual", "codigoObraAtual");
    push("Anexar à observação", "observacoes");
  } else if (tipo === "cadastrar_obras_lote") {
    const novas = Array.isArray((dados as any).novas) ? (dados as any).novas : [];
    const dup = Array.isArray((dados as any).duplicatas_resumo) ? (dados as any).duplicatas_resumo : [];
    entries.push({ label: "Novas obras", value: String(novas.length) });
    if (dup.length > 0) entries.push({ label: "Possíveis duplicatas", value: String(dup.length) });
    const amostra = novas.slice(0, 8).map((o: any) =>
      `${o.nome ?? "—"}${o.construtora ? ` (${o.construtora})` : ""}${o.cidade ? ` · ${o.cidade}` : ""}`,
    ).join("\n");
    if (amostra) entries.push({ label: "Amostra", value: amostra + (novas.length > 8 ? `\n…+${novas.length - 8}` : "") });
  } else {
    for (const [k, v] of Object.entries(dados)) {
      if (k === "codigoObra") continue;
      if (v === undefined || v === null || String(v).trim() === "") continue;
      entries.push({ label: k, value: typeof v === "object" ? JSON.stringify(v) : String(v) });
    }
  }
  return entries;
}

function AcaoCard({
  acao,
  messageId,
  initialStatus,
}: {
  acao: AcaoSugerida;
  messageId?: string;
  initialStatus: "pendente" | "aprovada" | "cancelada";
}) {
  type UIEstado = "pendente" | "executando" | "aprovada" | "cancelada" | "erro";
  const [estado, setEstado] = useState<UIEstado>(initialStatus);
  const [resumo, setResumo] = useState<string>("");
  const [erro, setErro] = useState<string>("");
  const disponivel = ACOES_DISPONIVEIS.has(acao.tipo);
  const label = ACAO_LABEL[acao.tipo] ?? acao.tipo;
  const entries = formatarDados(acao.tipo, acao.dados);

  async function persistStatus(novo: "aprovada" | "cancelada") {
    if (!messageId) return;
    await supabase
      .from("mensagens_michele")
      .update({ acao_status: novo })
      .eq("id", messageId);
  }

  async function handleCancelar() {
    await persistStatus("cancelada");
    setEstado("cancelada");
  }

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
      await persistStatus("aprovada");
      setEstado("aprovada");
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

      {estado === "aprovada" && (
        <div className="rounded-md bg-emerald-500/15 px-3 py-2 text-xs text-foreground flex items-start gap-2">
          <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
          <div>
            <div className="font-medium text-emerald-700 dark:text-emerald-300">
              ✅ Aprovado e executado
            </div>
            {resumo && <div className="text-muted-foreground mt-0.5">{resumo}</div>}
          </div>
        </div>
      )}

      {estado === "cancelada" && (
        <div className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
          <X className="h-3.5 w-3.5" />
          Cancelado
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
            onClick={handleCancelar}
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

function ChatImage({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await supabase.storage
        .from("michele-uploads")
        .createSignedUrl(path, 60 * 60);
      if (alive && !error) setUrl(data?.signedUrl ?? null);
    })();
    return () => {
      alive = false;
    };
  }, [path]);
  if (!url) {
    return (
      <div className="h-40 w-40 rounded-lg bg-muted animate-pulse" />
    );
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" className="block">
      <img
        src={url}
        alt="anexo"
        className="max-h-64 max-w-full rounded-lg border object-cover hover:opacity-90 transition"
      />
    </a>
  );
}




function PlanoCard({
  plano,
  messageId,
  initialStatus,
}: {
  plano: PlanoSugerido & { resultado?: any };
  messageId?: string;
  initialStatus: "pendente" | "aprovada" | "cancelada";
}) {
  type UIEstado = "pendente" | "executando" | "aprovada" | "cancelada" | "erro";
  const [estado, setEstado] = useState<UIEstado>(initialStatus);
  const [resultado, setResultado] = useState<any>(plano.resultado ?? null);
  const [erro, setErro] = useState<string>("");

  const grupos = {
    cadastrar_construtora: [] as PlanoAcao[],
    cadastrar_obra: [] as PlanoAcao[],
    cadastrar_contato: [] as PlanoAcao[],
    outros: [] as PlanoAcao[],
  };
  for (const a of plano.acoes) {
    if (a.tipo in grupos) (grupos as any)[a.tipo].push(a);
    else grupos.outros.push(a);
  }

  const renderItem = (a: PlanoAcao, i: number) => {
    const d = a.dados as any;
    const nome = d.nome ?? "(sem nome)";
    const detalhes: string[] = [];
    if (a.tipo === "cadastrar_construtora") {
      if (d.produto) detalhes.push(`produtos: ${d.produto}`);
      if (d.cnpj) detalhes.push(`cnpj: ${d.cnpj}`);
    } else if (a.tipo === "cadastrar_obra") {
      const c = d.construtora_nome ?? d.construtora;
      if (c) detalhes.push(`construtora: ${c}`);
      if (d.cidade) detalhes.push(d.cidade);
      if (d.produtoOferecido) detalhes.push(`produto: ${d.produtoOferecido}`);
      if (d.estagioObra) detalhes.push(d.estagioObra);
    } else if (a.tipo === "cadastrar_contato") {
      if (d.cargo) detalhes.push(d.cargo);
      if (d.whatsapp) detalhes.push(`wpp: ${d.whatsapp}`);
      const c = d.construtora_nome ?? d.construtora;
      const o = d.obra_nome ?? d.obra;
      if (o) detalhes.push(`obra: ${o}`);
      else if (c) detalhes.push(`construtora: ${c}`);
    }
    return (
      <li key={i} className="text-xs text-foreground">
        <span className="font-medium">{nome}</span>
        {detalhes.length > 0 && (
          <span className="text-muted-foreground"> — {detalhes.join(" · ")}</span>
        )}
      </li>
    );
  };

  const grupo = (titulo: string, itens: PlanoAcao[]) => itens.length > 0 && (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
        {titulo} ({itens.length})
      </div>
      <ul className="mt-1 space-y-0.5 pl-3 list-disc">
        {itens.map((a, i) => renderItem(a, i))}
      </ul>
    </div>
  );

  async function persistStatus(novo: "aprovada" | "cancelada", dadosExtra?: any) {
    if (!messageId) return;
    const payload: any = { acao_status: novo };
    if (dadosExtra) {
      payload.acao_dados = {
        tipo: "plano",
        dados: { titulo: plano.titulo, acoes: plano.acoes, resultado: dadosExtra },
      };
    }
    await supabase.from("mensagens_michele").update(payload).eq("id", messageId);
  }

  async function handleCancelar() {
    await persistStatus("cancelada");
    setEstado("cancelada");
  }

  async function handleExecutar() {
    setEstado("executando");
    setErro("");
    try {
      const { data, error } = await supabase.functions.invoke("michele-executar-lote", {
        body: { titulo: plano.titulo, acoes: plano.acoes },
      });
      if (error) throw error;
      const r = data as any;
      setResultado(r);
      await persistStatus("aprovada", r);
      setEstado("aprovada");
      toast.success(r?.resumo ?? "Plano executado.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErro(msg);
      setEstado("erro");
      toast.error("Erro ao executar o plano.");
    }
  }

  return (
    <div className="rounded-xl border-2 border-amber-500/50 bg-amber-500/5 p-3 space-y-3">
      <div className="flex items-start gap-2">
        <Zap className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide">
            Plano proposto · {plano.acoes.length} ações
          </div>
          <div className="text-sm font-medium text-foreground">{plano.titulo}</div>
        </div>
      </div>

      <div className="space-y-2 pl-6">
        {grupo("Construtoras", grupos.cadastrar_construtora)}
        {grupo("Obras", grupos.cadastrar_obra)}
        {grupo("Contatos", grupos.cadastrar_contato)}
        {grupos.outros.length > 0 && grupo("Outros", grupos.outros)}
      </div>

      {estado === "aprovada" && resultado && (
        <div className="rounded-md bg-emerald-500/15 px-3 py-2 text-xs space-y-1">
          <div className="font-medium text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
            <Check className="h-3.5 w-3.5" /> ✅ Plano executado
          </div>
          {resultado.resumo && <div className="text-muted-foreground">{resultado.resumo}</div>}
          {Array.isArray(resultado.construtoras_criadas) && resultado.construtoras_criadas.length > 0 && (
            <div><span className="font-medium">Construtoras criadas:</span> {resultado.construtoras_criadas.join(", ")}</div>
          )}
          {Array.isArray(resultado.obras_criadas) && resultado.obras_criadas.length > 0 && (
            <div><span className="font-medium">Obras criadas:</span> {resultado.obras_criadas.join(", ")}</div>
          )}
          {Array.isArray(resultado.contatos_criados) && resultado.contatos_criados.length > 0 && (
            <div><span className="font-medium">Contatos criados:</span> {resultado.contatos_criados.join(", ")}</div>
          )}
          {Array.isArray(resultado.reaproveitados) && resultado.reaproveitados.length > 0 && (
            <div><span className="font-medium">Já existiam (reaproveitados):</span> {resultado.reaproveitados.join(", ")}</div>
          )}
          {Array.isArray(resultado.erros) && resultado.erros.length > 0 && (
            <div className="text-destructive"><span className="font-medium">Erros:</span> {resultado.erros.join(" | ")}</div>
          )}
        </div>
      )}

      {estado === "aprovada" && !resultado && (
        <div className="rounded-md bg-emerald-500/15 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
          <Check className="h-3.5 w-3.5" /> ✅ Plano executado
        </div>
      )}

      {estado === "cancelada" && (
        <div className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
          <X className="h-3.5 w-3.5" /> Cancelado
        </div>
      )}

      {estado === "erro" && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {erro || "Erro ao executar."}
        </div>
      )}

      {(estado === "pendente" || estado === "executando" || estado === "erro") && (
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={handleCancelar} disabled={estado === "executando"}>
            <X className="h-3.5 w-3.5 mr-1" /> Cancelar
          </Button>
          <Button size="sm" onClick={handleExecutar} disabled={estado === "executando"}>
            {estado === "executando" ? (
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            ) : (
              <Zap className="h-3.5 w-3.5 mr-1" />
            )}
            {estado === "erro" ? "Tentar novamente" : "Aprovar tudo e executar"}
          </Button>
        </div>
      )}
    </div>
  );
}
