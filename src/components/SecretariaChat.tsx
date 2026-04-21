import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bot, Send, Loader2, X, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { mapFieldsToForm, type SecretariaAction } from "@/lib/secretariaFields";

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
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

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const applyAction = (action: SecretariaAction) => {
    if (action.modo === "editar" && action.id) {
      const formFields = mapFieldsToForm(action.campos);
      sessionStorage.setItem(
        "secretaria_prefill",
        JSON.stringify({ mode: "editar", id: action.id, fields: formFields }),
      );
      navigate(`/nova-obra?id=${encodeURIComponent(action.id)}`);
      toast({ title: "Abrindo obra", description: action.id });
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

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const next: ChatMsg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);

    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/secretaria`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: next.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Erro ${res.status}`);
      }

      const { action } = (await res.json()) as { action: SecretariaAction };
      const reply = action.mensagem || "Pronto.";
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
              placeholder="Ex: Crie obra Aurora em Campinas"
              disabled={loading}
            />
            <Button type="submit" size="icon" disabled={loading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      )}
    </>
  );
}
