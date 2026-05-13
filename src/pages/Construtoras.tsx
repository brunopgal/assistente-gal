import { useEffect, useMemo, useState } from "react";
import {
  listarConstrutoras,
  criarConstrutora,
  atualizarConstrutora,
  excluirConstrutora,
  listarAtividadesConstrutora,
  criarAtividadeConstrutora,
  excluirAtividadeConstrutora,
  sincronizarConstrutoras,
  sincronizarAtividadesConstrutoras,
  type Construtora,
  type AtividadeConstrutora,
  type TipoRegistroAtividade,
} from "@/services/construtorasService";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Building, Loader2, Plus, Search, Trash2, ListChecks, CalendarClock, X, Pencil, Info,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ConstrutoraInfoDialog from "@/components/ConstrutoraInfoDialog";

const PRODUTOS = ["Prado", "Rhoden", "Imab"] as const;
const STATUS_OPCOES = ["Já Cliente", "Prospecção"] as const;
const TIPOS_REGISTRO: { value: TipoRegistroAtividade; label: string }[] = [
  { value: "atividade", label: "Atividade" },
  { value: "visita", label: "Visita" },
  { value: "reuniao", label: "Reunião" },
];
const TIPOS_CONTATO = ["ligação", "whatsapp", "email", "visita", "presencial"];

function hoje(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function statusBadge(status: string): "default" | "secondary" | "outline" {
  if (status === "Já Cliente") return "default";
  if (status === "Prospecção") return "secondary";
  return "outline";
}

export default function Construtoras() {
  const [items, setItems] = useState<Construtora[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const { toast } = useToast();

  // Form nova construtora
  const [openNew, setOpenNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Construtora>({
    nome: "", cnpj: "", produto: "", status: "Prospecção", observacoes: "",
  });
  const [produtosSel, setProdutosSel] = useState<string[]>([]);

  // Form editar construtora
  const [openEdit, setOpenEdit] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editForm, setEditForm] = useState<Construtora | null>(null);
  const [editProdutosSel, setEditProdutosSel] = useState<string[]>([]);

  // Info dialog
  const [infoConstrutora, setInfoConstrutora] = useState<Construtora | null>(null);

  // Atividades dialog
  const [openAtv, setOpenAtv] = useState(false);
  const [construtoraSel, setConstrutoraSel] = useState<Construtora | null>(null);
  const [atividades, setAtividades] = useState<AtividadeConstrutora[]>([]);
  const [loadingAtv, setLoadingAtv] = useState(false);
  const [atvForm, setAtvForm] = useState<AtividadeConstrutora>({
    codigoConstrutora: "",
    tipoRegistro: "atividade",
    data: hoje(),
    horario: "",
    tipoContato: "",
    status: "",
    proximoContato: "",
    comentario: "",
    criarFollowUp: "",
  });
  const [savingAtv, setSavingAtv] = useState(false);

  async function carregar() {
    setLoading(true);
    try {
      const data = await listarConstrutoras();
      setItems(data);
    } catch (e) {
      toast({
        title: "Erro ao carregar construtoras",
        description: e instanceof Error ? e.message : "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        await sincronizarConstrutoras();
        await sincronizarAtividadesConstrutoras();
      } catch (e) {
        console.warn("Sync construtoras falhou:", e);
      }
      carregar();
    })();
  }, []);

  const filtradas = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((c) =>
      [c.codigo, c.nome, c.cnpj, c.produto, c.status]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [items, query]);

  function toggleProduto(p: string) {
    setProdutosSel((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    );
  }

  async function salvarNova() {
    if (!form.nome.trim()) {
      toast({ title: "Nome obrigatório", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload: Construtora = {
        ...form,
        produto: produtosSel.join(", "),
      };
      await criarConstrutora(payload);
      toast({ title: "Construtora criada" });
      setOpenNew(false);
      setForm({ nome: "", cnpj: "", produto: "", status: "Prospecção", observacoes: "" });
      setProdutosSel([]);
      carregar();
    } catch (e) {
      toast({
        title: "Erro ao criar",
        description: e instanceof Error ? e.message : "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function excluir(codigo: string) {
    if (!confirm("Excluir esta construtora?")) return;
    try {
      await excluirConstrutora(codigo);
      toast({ title: "Construtora excluída" });
      carregar();
    } catch (e) {
      toast({
        title: "Erro ao excluir",
        description: e instanceof Error ? e.message : "Tente novamente",
        variant: "destructive",
      });
    }
  }

  function abrirEditar(c: Construtora) {
    setEditForm({ ...c });
    // Normaliza para a capitalização canônica de PRODUTOS para evitar duplicar
    // ao re-selecionar (ex.: "PRADO" no banco vs "Prado" no UI).
    const canonicos = (c.produto || "")
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => {
        const match = PRODUTOS.find((x) => x.toLowerCase() === p.toLowerCase());
        return match || p;
      });
    // Remove duplicados preservando ordem
    const unique = Array.from(new Set(canonicos));
    setEditProdutosSel(unique);
    setOpenEdit(true);
  }

  async function salvarEdicao() {
    if (!editForm?.codigo) return;
    setSavingEdit(true);
    try {
      const payload: Partial<Construtora> = {
        nome: editForm.nome,
        cnpj: editForm.cnpj,
        produto: editProdutosSel.join(", "),
        status: editForm.status,
        observacoes: editForm.observacoes,
      };
      await atualizarConstrutora(editForm.codigo, payload);
      toast({ title: "Construtora atualizada" });
      setOpenEdit(false);
      setEditForm(null);
      carregar();
    } catch (e) {
      toast({
        title: "Erro ao atualizar",
        description: e instanceof Error ? e.message : "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setSavingEdit(false);
    }
  }

  function toggleEditProduto(p: string) {
    setEditProdutosSel((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    );
  }

  async function abrirAtividades(c: Construtora) {
    setConstrutoraSel(c);
    setOpenAtv(true);
    setAtvForm({
      codigoConstrutora: c.codigo || "",
      tipoRegistro: "atividade",
      data: hoje(),
      horario: "",
      tipoContato: "",
      status: "",
      proximoContato: "",
      comentario: "",
      criarFollowUp: "",
    });
    setLoadingAtv(true);
    try {
      const data = await listarAtividadesConstrutora(c.codigo || "");
      setAtividades(data);
    } catch (e) {
      toast({
        title: "Erro ao carregar atividades",
        description: e instanceof Error ? e.message : "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setLoadingAtv(false);
    }
  }

  async function salvarAtividade() {
    if (!atvForm.codigoConstrutora) return;
    setSavingAtv(true);
    try {
      await criarAtividadeConstrutora(atvForm);
      toast({ title: "Registro adicionado" });
      const data = await listarAtividadesConstrutora(atvForm.codigoConstrutora);
      setAtividades(data);
      setAtvForm({
        ...atvForm,
        horario: "",
        tipoContato: "",
        status: "",
        proximoContato: "",
        comentario: "",
        criarFollowUp: "",
      });
    } catch (e) {
      toast({
        title: "Erro ao salvar",
        description: e instanceof Error ? e.message : "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setSavingAtv(false);
    }
  }

  async function excluirAtv(id: string) {
    if (!confirm("Excluir este registro?")) return;
    try {
      await excluirAtividadeConstrutora(id);
      if (construtoraSel?.codigo) {
        const data = await listarAtividadesConstrutora(construtoraSel.codigo);
        setAtividades(data);
      }
    } catch (e) {
      toast({
        title: "Erro ao excluir",
        description: e instanceof Error ? e.message : "Tente novamente",
        variant: "destructive",
      });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1
            className="text-2xl font-bold text-foreground flex items-center gap-2"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            <Building className="h-6 w-6 text-primary" />
            Construtoras
          </h1>
          <p className="text-muted-foreground mt-1">
            Cadastre construtoras, produtos oferecidos e acompanhe atividades, visitas e reuniões
          </p>
        </div>
        <Dialog open={openNew} onOpenChange={setOpenNew}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-1" /> Nova Construtora
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Nova Construtora</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Nome *</Label>
                <Input
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  placeholder="Nome da construtora"
                />
              </div>
              <div>
                <Label>CNPJ</Label>
                <Input
                  value={form.cnpj}
                  onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
                  placeholder="00.000.000/0000-00"
                />
              </div>
              <div>
                <Label>Produto(s) oferecido(s)</Label>
                <div className="flex flex-wrap gap-3 mt-1">
                  {PRODUTOS.map((p) => (
                    <label key={p} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={produtosSel.includes(p)}
                        onCheckedChange={() => toggleProduto(p)}
                      />
                      {p}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPCOES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Observações</Label>
                <Textarea
                  value={form.observacoes}
                  onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpenNew(false)}>Cancelar</Button>
              <Button onClick={salvarNova} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, CNPJ, código, status..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="max-w-md"
            />
            <span className="text-xs text-muted-foreground ml-auto">
              {filtradas.length} de {items.length}
            </span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filtradas.length === 0 ? (
            <p className="text-center text-muted-foreground py-16">
              Nenhuma construtora cadastrada.
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">Código</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead className="hidden md:table-cell">CNPJ</TableHead>
                    <TableHead className="hidden md:table-cell">Produto</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtradas.map((c) => (
                    <TableRow key={c.codigo}>
                      <TableCell className="font-mono text-xs">{c.codigo}</TableCell>
                      <TableCell className="font-medium">{c.nome || "—"}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {c.cnpj || "—"}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {c.produto ? (
                          <div className="flex flex-wrap gap-1">
                            {c.produto.split(",").map((p) => p.trim()).filter(Boolean).map((p) => (
                              <Badge key={p} variant="outline" className="text-xs">{p}</Badge>
                            ))}
                          </div>
                        ) : <span className="text-muted-foreground text-xs">—</span>}
                      </TableCell>
                      <TableCell>
                        {c.status ? (
                          <Badge variant={statusBadge(c.status)} className="text-xs">{c.status}</Badge>
                        ) : <span className="text-muted-foreground text-xs">—</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap gap-1 justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8"
                            onClick={() => setInfoConstrutora(c)}
                          >
                            <Info className="h-3.5 w-3.5 mr-1" />
                            Informações
                          </Button>
                          <Button
                            variant="default"
                            size="sm"
                            className="h-8"
                            onClick={() => abrirAtividades(c)}
                          >
                            <ListChecks className="h-3.5 w-3.5 mr-1" />
                            Atividades
                          </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 ml-1"
                          onClick={() => abrirEditar(c)}
                        >
                          <Pencil className="h-3.5 w-3.5 mr-1" />
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 ml-1 text-destructive hover:text-destructive"
                          onClick={() => excluir(c.codigo || "")}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Edição de Construtora */}
      <Dialog open={openEdit} onOpenChange={setOpenEdit}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Construtora {editForm?.codigo ? `(${editForm.codigo})` : ""}</DialogTitle>
          </DialogHeader>
          {editForm && (
            <div className="space-y-3">
              <div>
                <Label>Nome *</Label>
                <Input
                  value={editForm.nome}
                  onChange={(e) => setEditForm({ ...editForm, nome: e.target.value })}
                />
              </div>
              <div>
                <Label>CNPJ</Label>
                <Input
                  value={editForm.cnpj}
                  onChange={(e) => setEditForm({ ...editForm, cnpj: e.target.value })}
                  placeholder="00.000.000/0000-00"
                />
              </div>
              <div>
                <Label>Produto(s) oferecido(s)</Label>
                <div className="flex flex-wrap gap-3 mt-1">
                  {PRODUTOS.map((p) => (
                    <label key={p} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={editProdutosSel.includes(p)}
                        onCheckedChange={() => toggleEditProduto(p)}
                      />
                      {p}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <Label>Status</Label>
                <Select
                  value={editForm.status}
                  onValueChange={(v) => setEditForm({ ...editForm, status: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPCOES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Observações</Label>
                <Textarea
                  value={editForm.observacoes || ""}
                  onChange={(e) => setEditForm({ ...editForm, observacoes: e.target.value })}
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenEdit(false)}>Cancelar</Button>
            <Button onClick={salvarEdicao} disabled={savingEdit}>
              {savingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Atividades / Visitas / Reuniões */}
      <Dialog open={openAtv} onOpenChange={setOpenAtv}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-primary" />
              Atividades — {construtoraSel?.nome}
            </DialogTitle>
          </DialogHeader>

          {/* Form de novo registro */}
          <Card className="bg-muted/30">
            <CardContent className="p-4 space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Tipo</Label>
                  <Select
                    value={atvForm.tipoRegistro}
                    onValueChange={(v) => setAtvForm({ ...atvForm, tipoRegistro: v as TipoRegistroAtividade })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TIPOS_REGISTRO.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Data (DD/MM/AAAA)</Label>
                  <Input
                    value={atvForm.data}
                    onChange={(e) => setAtvForm({ ...atvForm, data: e.target.value })}
                    placeholder="DD/MM/AAAA"
                  />
                </div>
                {atvForm.tipoRegistro !== "atividade" && (
                  <div>
                    <Label className="text-xs">Horário</Label>
                    <Input
                      type="time"
                      value={atvForm.horario}
                      onChange={(e) => setAtvForm({ ...atvForm, horario: e.target.value })}
                    />
                  </div>
                )}
                {atvForm.tipoRegistro === "atividade" && (
                  <div>
                    <Label className="text-xs">Tipo de contato</Label>
                    <Select
                      value={atvForm.tipoContato || ""}
                      onValueChange={(v) => setAtvForm({ ...atvForm, tipoContato: v })}
                    >
                      <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                      <SelectContent>
                        {TIPOS_CONTATO.map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div>
                  <Label className="text-xs">Status</Label>
                  <Input
                    value={atvForm.status}
                    onChange={(e) => setAtvForm({ ...atvForm, status: e.target.value })}
                    placeholder="Ex: agendado, realizado..."
                  />
                </div>
                <div>
                  <Label className="text-xs">Próximo contato</Label>
                  <Input
                    value={atvForm.proximoContato}
                    onChange={(e) => setAtvForm({ ...atvForm, proximoContato: e.target.value })}
                    placeholder="DD/MM/AAAA"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">Comentário</Label>
                <Textarea
                  value={atvForm.comentario}
                  onChange={(e) => setAtvForm({ ...atvForm, comentario: e.target.value })}
                  rows={2}
                />
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <Checkbox
                  checked={atvForm.criarFollowUp === "sim"}
                  onCheckedChange={(checked) =>
                    setAtvForm({ ...atvForm, criarFollowUp: checked ? "sim" : "" })
                  }
                  disabled={!atvForm.proximoContato}
                />
                <span>
                  Criar follow-up{" "}
                  <span className="text-xs text-muted-foreground">
                    (mostrar no painel Follow-up — requer Próximo contato)
                  </span>
                </span>
              </label>
              <div className="flex justify-end">
                <Button onClick={salvarAtividade} disabled={savingAtv}>
                  {savingAtv ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                    <><Plus className="h-4 w-4 mr-1" /> Adicionar</>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Histórico */}
          <div className="mt-2">
            <h3 className="font-semibold mb-2 text-sm">Histórico</h3>
            {loadingAtv ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : atividades.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhum registro ainda.
              </p>
            ) : (
              <div className="space-y-2">
                {atividades.map((a) => (
                  <div
                    key={a.idAtividade}
                    className="border rounded-md p-3 flex items-start justify-between gap-2"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-[10px] uppercase">
                          {a.tipoRegistro}
                        </Badge>
                        <span className="text-xs font-mono text-muted-foreground">
                          {a.data}{a.horario ? ` ${a.horario}` : ""}
                        </span>
                        {a.tipoContato && (
                          <Badge variant="secondary" className="text-[10px]">{a.tipoContato}</Badge>
                        )}
                        {a.status && (
                          <span className="text-xs text-muted-foreground">• {a.status}</span>
                        )}
                      </div>
                      {a.comentario && <p className="text-sm">{a.comentario}</p>}
                      {a.proximoContato && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Próximo contato: {a.proximoContato}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => excluirAtv(a.idAtividade || "")}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
