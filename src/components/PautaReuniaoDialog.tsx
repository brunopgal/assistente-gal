import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Mic,
  Square,
  Save,
  Trash2,
  ClipboardList,
} from "lucide-react";

interface Pauta {
  id: string;
  obra_id: string;
  conteudo: string;
  created_at: string;
  updated_at: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  obraId: string;
  obraNome?: string;
}

export default function PautaReuniaoDialog({ open, onOpenChange, obraId, obraNome }: Props) {
  const { toast } = useToast();
  const [pautas, setPautas] = useState<Pauta[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [input, setInput] = useState("");
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (!open || !obraId) return;
    void carregar();
  }, [open, obraId]);

  async function carregar() {
    setLoading(true);
    const { data, error } = await supabase
      .from("pautas_reuniao")
      .select("*")
      .eq("obra_id", obraId)
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) {
      toast({ title: "Erro ao carregar", description: error.message, variant: "destructive" });
      return;
    }
    setPautas((data || []) as Pauta[]);
  }

  async function salvar() {
    const conteudo = input.trim();
    if (!conteudo) return;
    setSaving(true);
    const { error } = await supabase
      .from("pautas_reuniao")
      .insert({ obra_id: obraId, conteudo });
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }
    setInput("");
    void carregar();
  }

  async function excluir(id: string) {
    const { error } = await supabase.from("pautas_reuniao").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
      return;
    }
    setPautas((p) => p.filter((x) => x.id !== id));
  }

  const blobToBase64 = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string).split(",")[1] || "");
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

  async function startRecording() {
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
          if (text) setInput((p) => (p ? `${p} ${text}` : text));
          else toast({ title: "Áudio vazio", description: "Não consegui transcrever." });
        } catch (e) {
          toast({
            title: "Erro",
            description: e instanceof Error ? e.message : "Erro na transcrição",
            variant: "destructive",
          });
        } finally {
          setTranscribing(false);
        }
      };
      mr.start();
      recorderRef.current = mr;
      setRecording(true);
    } catch (e) {
      toast({
        title: "Microfone bloqueado",
        description: e instanceof Error ? e.message : "Não foi possível acessar o microfone",
        variant: "destructive",
      });
    }
  }

  function stopRecording() {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    setRecording(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            Pauta da Reunião
          </DialogTitle>
          <DialogDescription>
            {obraNome ? `${obraNome} · ${obraId}` : obraId}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Textarea
            placeholder="Escreva a pauta ou grave um áudio..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={5}
          />
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              type="button"
              variant={recording ? "destructive" : "outline"}
              size="sm"
              onClick={recording ? stopRecording : startRecording}
              disabled={transcribing}
            >
              {recording ? (
                <><Square className="h-4 w-4 mr-1" /> Parar</>
              ) : transcribing ? (
                <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Transcrevendo...</>
              ) : (
                <><Mic className="h-4 w-4 mr-1" /> Gravar áudio</>
              )}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={salvar}
              disabled={saving || !input.trim()}
              className="ml-auto"
            >
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              Salvar anotação
            </Button>
          </div>
        </div>

        <div className="border-t pt-4 mt-2">
          <h3 className="text-sm font-semibold mb-2">Anotações ({pautas.length})</h3>
          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : pautas.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhuma anotação ainda.
            </p>
          ) : (
            <ul className="space-y-2">
              {pautas.map((p) => (
                <li key={p.id} className="rounded-md border p-3 bg-muted/30">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm whitespace-pre-wrap flex-1">{p.conteudo}</p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => excluir(p.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {new Date(p.created_at).toLocaleString("pt-BR")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
