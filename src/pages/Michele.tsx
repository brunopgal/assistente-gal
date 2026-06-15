import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Sparkles, Loader2, Plus, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type Message = { role: "user" | "assistant"; content: string };
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
      .select("role,content")
      .eq("conversa_id", conversaId)
      .order("created_at", { ascending: true });
    if (error) {
      console.error(error);
      setMessages([]);
      return;
    }
    setMessages((data ?? []) as Message[]);
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

      // Persist assistant message + bump conversation
      await supabase
        .from("mensagens_michele")
        .insert({ conversa_id: conversaId, role: "assistant", content: reply });
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
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2 whitespace-pre-wrap text-sm ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
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
