import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Search, Edit3, Trash2, Loader2, Users, Download, History, Building2, HardHat, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import {
  listarPessoas, criarPessoa, atualizarPessoa, excluirPessoa,
  CARGO_OPTIONS, type Pessoa,
} from "@/services/pessoasService";
import { listarConstrutoras, type Construtora } from "@/services/construtorasService";
import { listarObras, type Obra } from "@/services/obrasService";
import { listarTodasAtividades, atualizarAtividade, excluirAtividade, type Atividade } from "@/services/atividadesService";
import { normalizeText } from "@/lib/normalize";
import { exportarParaExcel } from "@/lib/exportXlsx";


const EMPTY: Pessoa = {
  codigoConstrutora: "",
  codigoObraAtual: "",
  nome: "",
  cargo: "Não Informado",
  whatsapp: "",
  email: "",
  observacoes: "",
};

export default function Pessoas() {
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [construtoras, setConstrutoras] = useState<Construtora[]>([]);
  const [obras, setObras] = useState<Obra[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filtroCT, setFiltroCT] = useState<string>("__all__");
  const [filtroCargo, setFiltroCargo] = useState<string>("__all__");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Pessoa | null>(null);
  const [form, setForm] = useState<Pessoa>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Pessoa | null>(null);

  // Histórico panel states
  const [historicoOpen, setHistoricoOpen] = useState<Pessoa | null>(null);
  const [historicoLoading, setHistoricoLoading] = useState(false);
  const [historicoAtividades, setHistoricoAtividades] = useState<Atividade[]>([]);
  const [historicoObra, setHistoricoObra] = useState<Obra | null>(null);

  async function loadHistorico(p: Pessoa) {
    setHistoricoLoading(true);
    setHistoricoAtividades([]);
    setHistoricoObra(null);
    try {
      const [todasObras, todasAtivs] = await Promise.all([
        listarObras(),
        listarTodasAtividades()
      ]);
      
      if (p.codigoObraAtual) {
        const obra = todasObras.find(o => o.codigoObra === p.codigoObraAtual || o.id === p.codigoObraAtual);
        if (obra) setHistoricoObra(obra);
      }

      const nomeContatoUpper = (p.nome || "").toUpperCase();
      const relacionadas = todasAtivs.filter(a => {
        const matchObra = p.codigoObraAtual && a.idObra === p.codigoObraAtual;
        const matchNome = nomeContatoUpper && (a.comentario || "").toUpperCase().includes(nomeContatoUpper);
        return matchObra || matchNome;
      });

      // Remove duplicates by idAtividade and sort desc by date
      const unicas = Array.from(new Map(relacionadas.map(a => [a.idAtividade, a])).values());
      unicas.sort((a, b) => {
        // Date format is DD/MM/YYYY, parse it to compare
        const parseBrDate = (dStr: string) => {
          if (!dStr) return 0;
          const parts = dStr.split("/");
          if (parts.length === 3) return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0])).getTime();
          return new Date(dStr).getTime();
        };
        return parseBrDate(b.dataAtividade || "") - parseBrDate(a.dataAtividade || "");
      });

      setHistoricoAtividades(unicas);
    } catch (e) {
      toast.error("Erro ao carregar histórico");
    } finally {
      setHistoricoLoading(false);
    }
  }

  // Edit Atividade states
  const [editingAtv, setEditingAtv] = useState<Atividade | null>(null);
  const [formAtv, setFormAtv] = useState<Partial<Atividade>>({});
  const [savingAtv, setSavingAtv] = useState(false);

  async function saveHistoricoPessoa(codigoConstrutora: string, codigoObraAtual: string) {
    if (!historicoOpen?.codigoPessoa) return;
    try {
      await atualizarPessoa(historicoOpen.codigoPessoa, { codigoConstrutora, codigoObraAtual });
      toast.success("Vínculos atualizados");
      const updated = { ...historicoOpen, codigoConstrutora, codigoObraAtual };
      setHistoricoOpen(updated);
      await loadHistorico(updated);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function saveAtv() {
    if (!editingAtv?.idAtividade) return;
    setSavingAtv(true);
    try {
      await atualizarAtividade(editingAtv.idAtividade, formAtv);
      toast.success("Atividade atualizada");
      setEditingAtv(null);
      await loadHistorico(historicoOpen!);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSavingAtv(false);
    }
  }

  async function deleteAtv(id: string) {
    if (!confirm("Excluir esta atividade?")) return;
    try {
      await excluirAtividade(id);
      toast.success("Atividade excluída");
      await loadHistorico(historicoOpen!);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  useEffect(() => {
    if (historicoOpen) {
      loadHistorico(historicoOpen);
    }
  }, [historicoOpen]);

  async function load() {
    setLoading(true);
    try {
      const [p, c, o] = await Promise.all([listarPessoas(), listarConstrutoras(), listarObras()]);
      setPessoas(p);
      setConstrutoras(c);
      setObras(o);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const ctByCodigo = useMemo(() => {
    const m = new Map<string, Construtora>();
    construtoras.forEach(c => { if (c.codigo) m.set(c.codigo, c); });
    return m;
  }, [construtoras]);

  const filtradas = useMemo(() => {
    const q = normalizeText(query);
    return pessoas.filter(p => {
      if (filtroCT !== "__all__" && p.codigoConstrutora !== filtroCT) return false;
      if (filtroCargo !== "__all__" && (p.cargo || "") !== filtroCargo) return false;
      if (!q) return true;
      const haystack = [
        p.nome, p.cargo, p.whatsapp, p.email,
        ctByCodigo.get(p.codigoConstrutora)?.nome || "",
      ].map(normalizeText).join(" ");
      return haystack.includes(q);
    });
  }, [pessoas, query, filtroCT, filtroCargo, ctByCodigo]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setDialogOpen(true);
  }

  function openEdit(p: Pessoa) {
    setEditing(p);
    setForm({ ...EMPTY, ...p });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.nome.trim()) { toast.error("Nome é obrigatório"); return; }
    if (!form.codigoConstrutora) { toast.error("Selecione a construtora"); return; }
    setSaving(true);
    try {
      if (editing?.codigoPessoa) {
        await atualizarPessoa(editing.codigoPessoa, form);
        toast.success("Pessoa atualizada");
      } else {
        await criarPessoa(form);
        toast.success("Pessoa criada");
      }
      setDialogOpen(false);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirmDelete?.codigoPessoa) return;
    try {
      await excluirPessoa(confirmDelete.codigoPessoa);
      toast.success("Pessoa excluída");
      setConfirmDelete(null);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">Pessoas</h1>
          <Badge variant="secondary">{pessoas.length}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              try {
                const { listarObras } = await import("@/services/obrasService");
                const obras = await listarObras().catch(() => []);
                const obraByCodigo = new Map<string, string>();
                obras.forEach((o) => {
                  const key = o.codigoObra || o.id || "";
                  if (key) obraByCodigo.set(key, o.nome || "");
                });
                const rows = filtradas.map((p) => ({
                  ...p,
                  construtoraNome: ctByCodigo.get(p.codigoConstrutora)?.nome || "",
                  obraNome: obraByCodigo.get(p.codigoObraAtual || "") || "",
                }));
                exportarParaExcel(rows as unknown as Record<string, unknown>[], "contatos", "Contatos");
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
            disabled={loading || pessoas.length === 0}
          >
            <Download className="h-4 w-4 mr-1" /> Exportar Excel
          </Button>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" /> Nova pessoa
          </Button>
        </div>
      </div>




      {/* Filtros */}
      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, cargo, contato ou construtora..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filtroCT} onValueChange={setFiltroCT}>
          <SelectTrigger className="w-[240px]"><SelectValue placeholder="Construtora" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas as construtoras</SelectItem>
            {construtoras
              .filter(c => c.codigo)
              .sort((a, b) => (a.nome || "").localeCompare(b.nome || ""))
              .map(c => (
                <SelectItem key={c.codigo} value={c.codigo!}>{c.nome}</SelectItem>
              ))}
          </SelectContent>
        </Select>
        <Select value={filtroCargo} onValueChange={setFiltroCargo}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Cargo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos os cargos</SelectItem>
            {CARGO_OPTIONS.map(c => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(filtroCT !== "__all__" || filtroCargo !== "__all__" || query) && (
          <Button variant="ghost" size="sm" onClick={() => {
            setFiltroCT("__all__"); setFiltroCargo("__all__"); setQuery("");
          }}>Limpar filtros</Button>
        )}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtradas.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">
          Nenhuma pessoa encontrada.
        </CardContent></Card>
      ) : (
        <div className="grid gap-2">
          {filtradas.map((p) => {
            const ct = ctByCodigo.get(p.codigoConstrutora);
            return (
              <Card key={p.codigoPessoa}>
                <CardContent className="p-4 flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-[240px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{p.nome}</span>
                      <Badge variant="outline">{p.cargo || "—"}</Badge>
                      <span className="text-[10px] text-muted-foreground font-mono">{p.codigoPessoa}</span>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {ct?.nome || p.codigoConstrutora}
                      {p.codigoObraAtual && <span className="ml-2 font-mono text-[11px]">· {p.codigoObraAtual}</span>}
                    </div>
                    <div className="text-sm mt-1 flex gap-3 flex-wrap">
                      {p.whatsapp && <span>📱 {p.whatsapp}</span>}
                      {p.email && <span>✉️ {p.email}</span>}
                    </div>
                    {p.observacoes && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.observacoes}</p>
                    )}
                  </div>
                  <div className="flex gap-1 items-center">
                    <Button variant="ghost" size="sm" onClick={() => setHistoricoOpen(p)} title="Histórico / Relacionados">
                      <History className="h-4 w-4 mr-1 text-muted-foreground" />
                      <span className="text-xs hidden sm:inline">Histórico</span>
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                      <Edit3 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setConfirmDelete(p)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog Create/Edit */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar pessoa" : "Nova pessoa"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Construtora *</label>
              <Select
                value={form.codigoConstrutora}
                onValueChange={(v) => setForm({ ...form, codigoConstrutora: v })}
              >
                <SelectTrigger><SelectValue placeholder="Selecione a construtora" /></SelectTrigger>
                <SelectContent>
                  {construtoras
                    .filter(c => c.codigo)
                    .sort((a, b) => (a.nome || "").localeCompare(b.nome || ""))
                    .map(c => (
                      <SelectItem key={c.codigo} value={c.codigo!}>{c.nome}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Nome *</label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Cargo</label>
                <Select value={form.cargo} onValueChange={(v) => setForm({ ...form, cargo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CARGO_OPTIONS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Código Obra Atual</label>
                <Input
                  placeholder="OBRA000000001 (opcional)"
                  value={form.codigoObraAtual || ""}
                  onChange={(e) => setForm({ ...form, codigoObraAtual: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">WhatsApp</label>
                <Input
                  placeholder="(00) 00000-0000"
                  value={form.whatsapp || ""}
                  onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Email</label>
                <Input
                  type="email"
                  value={form.email || ""}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Observações</label>
              <Textarea
                rows={3}
                value={form.observacoes || ""}
                onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {editing ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir pessoa?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A pessoa <strong>{confirmDelete?.nome}</strong> será removida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog Histórico */}
      <Dialog open={!!historicoOpen} onOpenChange={(o) => !o && setHistoricoOpen(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-6 py-4 border-b shrink-0">
            <DialogTitle>Histórico — {historicoOpen?.nome}</DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-auto p-6 space-y-6">
            {historicoLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-muted/30 p-3 rounded-lg border">
                    <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                      <Building2 className="h-4 w-4" /> Relacionado a (Construtora)
                    </div>
                    <Select
                      value={historicoOpen?.codigoConstrutora || "none"}
                      onValueChange={(v) => saveHistoricoPessoa(v === "none" ? "" : v, historicoOpen?.codigoObraAtual || "")}
                    >
                      <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhuma construtora</SelectItem>
                        {construtoras
                          .filter(c => c.codigo)
                          .sort((a, b) => (a.nome || "").localeCompare(b.nome || ""))
                          .map(c => (
                            <SelectItem key={c.codigo} value={c.codigo!}>{c.nome}</SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <div className="text-xs text-muted-foreground mt-2 px-1">
                      Cargo: {historicoOpen?.cargo || "Não informado"}
                    </div>
                  </div>
                  
                  <div className="bg-muted/30 p-3 rounded-lg border">
                    <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                      <HardHat className="h-4 w-4" /> Obra Atual
                    </div>
                    <Select
                      value={historicoOpen?.codigoObraAtual || "none"}
                      onValueChange={(v) => saveHistoricoPessoa(historicoOpen?.codigoConstrutora || "", v === "none" ? "" : v)}
                    >
                      <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Nenhuma obra" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhuma obra</SelectItem>
                        {obras.map(o => (
                          <SelectItem key={o.codigoObra || o.id} value={(o.codigoObra || o.id)!}>
                            {o.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {historicoObra && (
                      <div className="mt-2 px-1">
                        <Badge variant="outline" className="text-[10px] uppercase">{historicoObra.statusProspeccao || "A Iniciar"}</Badge>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <CalendarClock className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold text-lg">Histórico de Atividades</h3>
                  </div>
                  
                  {historicoAtividades.length === 0 ? (
                    <Card className="border-dashed">
                      <CardContent className="py-8 text-center text-muted-foreground flex flex-col items-center">
                        <History className="h-8 w-8 mb-2 opacity-50" />
                        <p>Nenhuma atividade relacionada ainda.</p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-3 relative before:absolute before:inset-0 before:ml-2 before:-translate-x-px md:before:ml-[22px] md:before:translate-x-0 before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border/50 before:to-transparent">
                      {historicoAtividades.map((atv, idx) => (
                        <div key={atv.idAtividade || idx} className="relative flex items-start justify-between gap-4 md:gap-6 bg-card rounded-lg border p-3 md:p-4 shadow-sm hover:shadow-md transition-shadow group">
                          <div className="absolute left-0 md:left-5 top-4 md:top-5 w-2 h-2 rounded-full bg-primary/40 ring-4 ring-background z-10" />
                          <div className="flex-1 space-y-2 pl-4 md:pl-8">
                            {editingAtv?.idAtividade === atv.idAtividade ? (
                              <div className="space-y-3 bg-muted/20 p-3 rounded border border-border/50">
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <label className="text-[10px] uppercase font-bold text-muted-foreground">Tipo</label>
                                    <Input
                                      className="h-8 text-sm"
                                      value={formAtv.tipoContato || ""}
                                      onChange={e => setFormAtv({ ...formAtv, tipoContato: e.target.value })}
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[10px] uppercase font-bold text-muted-foreground">Data</label>
                                    <Input
                                      className="h-8 text-sm"
                                      value={formAtv.dataAtividade || ""}
                                      onChange={e => setFormAtv({ ...formAtv, dataAtividade: e.target.value })}
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[10px] uppercase font-bold text-muted-foreground">Status</label>
                                    <Input
                                      className="h-8 text-sm"
                                      value={formAtv.status || ""}
                                      onChange={e => setFormAtv({ ...formAtv, status: e.target.value })}
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[10px] uppercase font-bold text-muted-foreground">Próximo Contato</label>
                                    <Input
                                      className="h-8 text-sm"
                                      value={formAtv.proximoContato || ""}
                                      onChange={e => setFormAtv({ ...formAtv, proximoContato: e.target.value })}
                                    />
                                  </div>
                                </div>
                                <div>
                                  <label className="text-[10px] uppercase font-bold text-muted-foreground">Comentário</label>
                                  <Textarea
                                    rows={2}
                                    className="text-sm"
                                    value={formAtv.comentario || ""}
                                    onChange={e => setFormAtv({ ...formAtv, comentario: e.target.value })}
                                  />
                                </div>
                                <div className="flex gap-2 justify-end pt-1">
                                  <Button size="sm" variant="ghost" onClick={() => setEditingAtv(null)}>Cancelar</Button>
                                  <Button size="sm" onClick={saveAtv} disabled={savingAtv}>Salvar</Button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <Badge variant="secondary" className="font-mono text-xs">
                                      {atv.dataAtividade}
                                    </Badge>
                                    {atv.tipoContato && (
                                      <Badge variant="outline" className="capitalize text-[10px]">
                                        {atv.tipoContato}
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {atv.status && (
                                      <Badge variant={atv.status === 'Realizado' ? 'default' : 'secondary'} className="text-[10px] w-fit">
                                        {atv.status}
                                      </Badge>
                                    )}
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 bg-background/80 rounded px-1">
                                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => {
                                        setEditingAtv(atv);
                                        setFormAtv({ ...atv });
                                      }}>
                                        <Edit3 className="h-3 w-3" />
                                      </Button>
                                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:bg-destructive/10" onClick={() => deleteAtv(atv.idAtividade!)}>
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                                <div className="text-sm text-foreground/90 whitespace-pre-wrap">
                                  {atv.comentario || <span className="italic opacity-50">Sem descrição</span>}
                                </div>
                                {atv.proximoContato && (
                                  <div className="text-xs font-medium text-primary bg-primary/5 rounded px-2 py-1 w-fit border border-primary/10">
                                    Próximo: {atv.proximoContato}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
          <DialogFooter className="px-6 py-4 border-t shrink-0">
            <Button variant="outline" onClick={() => setHistoricoOpen(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
