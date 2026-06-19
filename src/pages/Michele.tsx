import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Bot, MessageSquare, Save, Loader2, RefreshCw, Clock,
  Trash2, Eye, EyeOff, Shield, Zap, Brain, AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

type Memoria = {
  id: string;
  tipo: "preferencia" | "cliente" | "correcao" | "geral";
  escopo: string;
  conteudo: string;
  ativo: boolean;
  created_at: string;
};

const DIAS_SEMANA = [
  { key: "seg", label: "Seg" },
  { key: "ter", label: "Ter" },
  { key: "qua", label: "Qua" },
  { key: "qui", label: "Qui" },
  { key: "sex", label: "Sex" },
  { key: "sab", label: "Sáb" },
  { key: "dom", label: "Dom" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getConfig(chave: string): Promise<string> {
  const { data } = await supabase
    .from("configuracoes")
    .select("valor")
    .eq("chave", chave)
    .maybeSingle();
  return data?.valor ?? "";
}

async function setConfig(chave: string, valor: string): Promise<void> {
  const { error } = await supabase
    .from("configuracoes")
    .upsert({ chave, valor }, { onConflict: "chave" });
  if (error) throw error;
}

function SectionHeader({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description?: string }) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div>
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
      </div>
    </div>
  );
}

// ── 1. System Prompt ──────────────────────────────────────────────────────────

function SecaoPersonalidade() {
  const [valor, setValor] = useState("");
  const [original, setOriginal] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    const v = await getConfig("system_prompt_michele");
    setValor(v);
    setOriginal(v);
    setLoading(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  async function salvar() {
    setSaving(true);
    try {
      await setConfig("system_prompt_michele", valor);
      setOriginal(valor);
      toast.success("System prompt salvo!");
    } catch {
      toast.error("Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  const alterado = valor !== original;

  return (
    <Card>
      <CardHeader className="pb-3">
        <SectionHeader
          icon={Bot}
          title="Personalidade e instruções"
          description="Edite o system prompt que define o comportamento da Michele. Salve para aplicar imediatamente."
        />
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <Textarea
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              rows={12}
              className="font-mono text-sm resize-y"
              placeholder="Digite as instruções da Michele aqui…"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {valor.length} caracteres
                {alterado && <span className="ml-2 text-amber-600 font-medium">• alterações não salvas</span>}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={carregar} disabled={loading || saving}>
                  <RefreshCw className="h-4 w-4 mr-1" />Recarregar
                </Button>
                <Button size="sm" onClick={salvar} disabled={saving || !alterado}>
                  {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                  Salvar
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── 2. Horários ───────────────────────────────────────────────────────────────

const HORARIO_KEYS = {
  manha_inicio: "horario_inicio_manha",
  manha_fim: "horario_fim_manha",
  tarde_inicio: "horario_inicio_tarde",
  tarde_fim: "horario_fim_tarde",
  dias: "dias_semana_prospeccao",
};

type HorarioState = {
  manha_inicio: string;
  manha_fim: string;
  tarde_inicio: string;
  tarde_fim: string;
  dias: string;
};

function SecaoHorarios() {
  const [vals, setVals] = useState<HorarioState>({ manha_inicio: "08:00", manha_fim: "12:00", tarde_inicio: "13:00", tarde_fim: "18:00", dias: "seg,ter,qua,qui,sex" });
  const [original, setOriginal] = useState<HorarioState>(vals);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [mi, mf, ti, tf, dias] = await Promise.all([
        getConfig(HORARIO_KEYS.manha_inicio),
        getConfig(HORARIO_KEYS.manha_fim),
        getConfig(HORARIO_KEYS.tarde_inicio),
        getConfig(HORARIO_KEYS.tarde_fim),
        getConfig(HORARIO_KEYS.dias),
      ]);
      const s: HorarioState = {
        manha_inicio: mi || "08:00",
        manha_fim: mf || "12:00",
        tarde_inicio: ti || "13:00",
        tarde_fim: tf || "18:00",
        dias: dias || "seg,ter,qua,qui,sex",
      };
      setVals(s);
      setOriginal(s);
      setLoading(false);
    })();
  }, []);

  function toggleDia(key: string) {
    const atual = vals.dias.split(",").filter(Boolean);
    const next = atual.includes(key) ? atual.filter((d) => d !== key) : [...atual, key];
    setVals((v) => ({ ...v, dias: next.join(",") }));
  }

  async function salvar() {
    setSaving(true);
    try {
      await Promise.all([
        setConfig(HORARIO_KEYS.manha_inicio, vals.manha_inicio),
        setConfig(HORARIO_KEYS.manha_fim, vals.manha_fim),
        setConfig(HORARIO_KEYS.tarde_inicio, vals.tarde_inicio),
        setConfig(HORARIO_KEYS.tarde_fim, vals.tarde_fim),
        setConfig(HORARIO_KEYS.dias, vals.dias),
      ]);
      setOriginal(vals);
      toast.success("Horários salvos!");
    } catch {
      toast.error("Erro ao salvar horários.");
    } finally {
      setSaving(false);
    }
  }

  const diasSelecionados = vals.dias.split(",").filter(Boolean);
  const alterado = JSON.stringify(vals) !== JSON.stringify(original);

  return (
    <Card>
      <CardHeader className="pb-3">
        <SectionHeader
          icon={Clock}
          title="Horários de prospecção"
          description="Defina os horários em que a Michele pode enviar e-mails e fazer prospecções automáticas."
        />
      </CardHeader>
      <CardContent className="space-y-5">
        {loading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">Manhã — início</label>
                <Input type="time" value={vals.manha_inicio} onChange={(e) => setVals((v) => ({ ...v, manha_inicio: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">Manhã — fim</label>
                <Input type="time" value={vals.manha_fim} onChange={(e) => setVals((v) => ({ ...v, manha_fim: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">Tarde — início</label>
                <Input type="time" value={vals.tarde_inicio} onChange={(e) => setVals((v) => ({ ...v, tarde_inicio: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">Tarde — fim</label>
                <Input type="time" value={vals.tarde_fim} onChange={(e) => setVals((v) => ({ ...v, tarde_fim: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Dias da semana</label>
              <div className="flex flex-wrap gap-2">
                {DIAS_SEMANA.map(({ key, label }) => {
                  const ativo = diasSelecionados.includes(key);
                  return (
                    <button
                      key={key}
                      onClick={() => toggleDia(key)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                        ativo
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background text-muted-foreground border-border hover:bg-muted"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end">
              <Button size="sm" onClick={salvar} disabled={saving || !alterado}>
                {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                Salvar horários
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── 3. Limites ────────────────────────────────────────────────────────────────

function SecaoLimites() {
  const [limiteEmail, setLimiteEmail] = useState("20");
  const [limiteWpp, setLimiteWpp] = useState("0");
  const [originalEmail, setOriginalEmail] = useState("20");
  const [originalWpp, setOriginalWpp] = useState("0");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [e, w] = await Promise.all([
        getConfig("limite_diario_email"),
        getConfig("limite_diario_whatsapp"),
      ]);
      const ev = e || "20"; const wv = w || "0";
      setLimiteEmail(ev); setOriginalEmail(ev);
      setLimiteWpp(wv); setOriginalWpp(wv);
      setLoading(false);
    })();
  }, []);

  async function salvar() {
    setSaving(true);
    try {
      await Promise.all([
        setConfig("limite_diario_email", limiteEmail),
        setConfig("limite_diario_whatsapp", limiteWpp),
      ]);
      setOriginalEmail(limiteEmail); setOriginalWpp(limiteWpp);
      toast.success("Limites salvos!");
    } catch {
      toast.error("Erro ao salvar limites.");
    } finally {
      setSaving(false);
    }
  }

  const alterado = limiteEmail !== originalEmail || limiteWpp !== originalWpp;

  return (
    <Card>
      <CardHeader className="pb-3">
        <SectionHeader
          icon={Shield}
          title="Limites de envio"
          description="Controle o máximo de mensagens automáticas por dia. Defina 0 para desativar."
        />
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">Limite diário de e-mails</label>
                <Input
                  type="number"
                  min={0}
                  max={500}
                  value={limiteEmail}
                  onChange={(e) => setLimiteEmail(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Máximo de e-mails que a Michele pode enviar por dia.</p>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground flex items-center gap-2">
                  Limite diário de WhatsApp
                  <Badge variant="outline" className="text-xs">em breve</Badge>
                </label>
                <Input type="number" min={0} max={500} value={limiteWpp} onChange={(e) => setLimiteWpp(e.target.value)} disabled />
                <p className="text-xs text-muted-foreground">Integração com WhatsApp ainda não implementada.</p>
              </div>
            </div>
            <div className="flex justify-end">
              <Button size="sm" onClick={salvar} disabled={saving || !alterado}>
                {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                Salvar limites
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── 4. Memória ────────────────────────────────────────────────────────────────

const TIPO_COLOR: Record<string, string> = {
  preferencia: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  cliente: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  correcao: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
  geral: "bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20",
};

function SecaoMemoria() {
  const [memorias, setMemorias] = useState<Memoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<"todos" | Memoria["tipo"]>("todos");

  const carregar = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("memoria_michele")
      .select("id,tipo,escopo,conteudo,ativo,created_at")
      .order("created_at", { ascending: false });
    if (error) { console.error(error); toast.error("Erro ao carregar memórias."); }
    else setMemorias((data ?? []) as Memoria[]);
    setLoading(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  async function toggleAtivo(m: Memoria) {
    setTogglingId(m.id);
    const { error } = await supabase.from("memoria_michele").update({ ativo: !m.ativo }).eq("id", m.id);
    if (error) toast.error("Erro ao atualizar.");
    else setMemorias((prev) => prev.map((x) => x.id === m.id ? { ...x, ativo: !m.ativo } : x));
    setTogglingId(null);
  }

  async function excluir(id: string) {
    setDeletingId(id);
    const { error } = await supabase.from("memoria_michele").delete().eq("id", id);
    if (error) toast.error("Erro ao excluir.");
    else { setMemorias((prev) => prev.filter((x) => x.id !== id)); toast.success("Memória excluída."); }
    setDeletingId(null);
  }

  const filtradas = filtro === "todos" ? memorias : memorias.filter((m) => m.tipo === filtro);
  const contagem = { todos: memorias.length, preferencia: memorias.filter((m) => m.tipo === "preferencia").length, cliente: memorias.filter((m) => m.tipo === "cliente").length, correcao: memorias.filter((m) => m.tipo === "correcao").length, geral: memorias.filter((m) => m.tipo === "geral").length };

  return (
    <Card>
      <CardHeader className="pb-3">
        <SectionHeader
          icon={Brain}
          title="Memória"
          description="Veja o que a Michele aprendeu. Ative, desative ou exclua aprendizados conforme necessário."
        />
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-2">
          {(["todos", "preferencia", "cliente", "correcao", "geral"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFiltro(t)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                filtro === t ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              {t === "todos" ? "Todos" : t} ({contagem[t]})
            </button>
          ))}
          <Button variant="ghost" size="sm" onClick={carregar} className="ml-auto h-7">
            <RefreshCw className="h-3.5 w-3.5 mr-1" />Recarregar
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : filtradas.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-8">Nenhuma memória {filtro !== "todos" ? `do tipo "${filtro}" ` : ""}encontrada.</p>
        ) : (
          <div className="space-y-2">
            {filtradas.map((m) => (
              <div
                key={m.id}
                className={`rounded-lg border p-3 flex items-start gap-3 transition-opacity ${!m.ativo ? "opacity-50" : ""}`}
              >
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${TIPO_COLOR[m.tipo]}`}>
                      {m.tipo}
                    </span>
                    <span className="text-xs text-muted-foreground">{m.escopo}</span>
                    {!m.ativo && <Badge variant="outline" className="text-xs">inativo</Badge>}
                  </div>
                  <p className="text-sm text-foreground break-words">{m.conteudo}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(m.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    title={m.ativo ? "Desativar" : "Ativar"}
                    disabled={togglingId === m.id}
                    onClick={() => toggleAtivo(m)}
                  >
                    {togglingId === m.id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : m.ativo ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                    title="Excluir"
                    disabled={deletingId === m.id}
                    onClick={() => excluir(m.id)}
                  >
                    {deletingId === m.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── 5. Regras automáticas (somente leitura) ───────────────────────────────────

function SecaoRegras() {
  const regras = [
    {
      icone: CheckCircle2,
      cor: "text-emerald-600 dark:text-emerald-400",
      titulo: "Checar resposta após envio",
      desc: "Quando um e-mail de prospecção é enviado, o sistema cria automaticamente um follow-up de verificação em 2 dias úteis. Se não houver resposta, um novo follow-up de reenvio é sugerido.",
    },
    {
      icone: Zap,
      cor: "text-amber-500",
      titulo: "Cliente quente — abertura de e-mail",
      desc: "Se o destinatário abrir o e-mail enviado pela Michele, o sistema detecta e classifica automaticamente como 'cliente quente', criando um follow-up prioritário de contato.",
    },
    {
      icone: AlertCircle,
      cor: "text-blue-500",
      titulo: "Ações estratégicas — aprovação manual",
      desc: "Follow-ups que envolvem julgamento (mudar abordagem, propor reunião, escalar para visita) NÃO são criados automaticamente. A Michele os sugere e você aprova. Só os mecânicos e óbvios são automáticos.",
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <SectionHeader
          icon={Zap}
          title="Regras de follow-up automático"
          description="Estas automações estão ativas. São somente informativas — não podem ser editadas aqui."
        />
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {regras.map((r, i) => (
            <div key={i} className="flex gap-3">
              <r.icone className={`h-5 w-5 shrink-0 mt-0.5 ${r.cor}`} />
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">{r.titulo}</p>
                <p className="text-sm text-muted-foreground">{r.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Michele() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center">
            <Bot className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1
              className="text-2xl font-bold text-foreground flex items-center gap-2"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              Michele
              <Badge variant="secondary" className="text-xs font-normal">Configurações</Badge>
            </h1>
            <p className="text-sm text-muted-foreground">Assistente de prospecção · Gal Representações</p>
          </div>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/michele/chat">
            <MessageSquare className="h-4 w-4 mr-2" />
            Abrir chat
          </Link>
        </Button>
      </div>

      <Separator />

      {/* Sections */}
      <SecaoPersonalidade />
      <SecaoHorarios />
      <SecaoLimites />
      <SecaoMemoria />
      <SecaoRegras />
    </div>
  );
}
