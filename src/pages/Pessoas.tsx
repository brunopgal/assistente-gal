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
import { Plus, Search, Edit3, Trash2, Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import {
  listarPessoas, criarPessoa, atualizarPessoa, excluirPessoa,
  CARGO_OPTIONS, type Pessoa,
} from "@/services/pessoasService";
import { listarConstrutoras, type Construtora } from "@/services/construtorasService";
import { normalizeText } from "@/lib/normalize";

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
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filtroCT, setFiltroCT] = useState<string>("__all__");
  const [filtroCargo, setFiltroCargo] = useState<string>("__all__");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Pessoa | null>(null);
  const [form, setForm] = useState<Pessoa>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Pessoa | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [p, c] = await Promise.all([listarPessoas(), listarConstrutoras()]);
      setPessoas(p);
      setConstrutoras(c);
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
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" /> Nova pessoa
        </Button>
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
                  <div className="flex gap-1">
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
    </div>
  );
}
