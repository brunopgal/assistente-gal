import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  listarAtividadesPorObra,
  criarAtividade,
  atualizarAtividade,
  excluirAtividade,
  type Atividade,
} from "@/services/atividadesService";
import { buscarObra, atualizarFollowUp, type Obra } from "@/services/obrasService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  Loader2,
  Phone,
  MessageSquare,
  Mail,
  MapPin,
  CalendarClock,
  Plus,
  History,
  Pencil,
  Trash2,
  X,
  Check,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const TIPOS = [
  { value: "ligação", label: "Ligação", icon: Phone },
  { value: "whatsapp", label: "WhatsApp", icon: MessageSquare },
  { value: "email", label: "Email", icon: Mail },
  { value: "visita", label: "Visita", icon: MapPin },
] as const;

function tipoIcon(tipo: string) {
  const t = TIPOS.find((x) => x.value === tipo.toLowerCase());
  return t?.icon || CalendarClock;
}

function todayBR(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function isoToBR(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function brToIso(br: string): string {
  if (!br) return "";
  const [d, m, y] = br.split("/");
  if (!y) return "";
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function dateForSort(br: string): string {
  return brToIso(br) || "0000-00-00";
}

export default function Atividades() {
  const { id } = useParams<{ id: string }>();
  const obraId = id || "";
  const { toast } = useToast();

  const [obra, setObra] = useState<Obra | null>(null);
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // form state (nova)
  const [tipoContato, setTipoContato] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [proximoContatoIso, setProximoContatoIso] = useState<string>("");
  const [comentario, setComentario] = useState<string>("");
  const [semProximoContato, setSemProximoContato] = useState<boolean>(false);

  // edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Atividade>>({});
  const [editSaving, setEditSaving] = useState(false);
  const [editProxIso, setEditProxIso] = useState<string>("");
  const [editSemProx, setEditSemProx] = useState<boolean>(false);

  // delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const carregar = async () => {
    setLoading(true);
    try {
      const [obraData, ativs] = await Promise.all([
        buscarObra(obraId).catch(() => null),
        listarAtividadesPorObra(obraId),
      ]);
      setObra(obraData);
      const ordenadas = [...ativs].sort((a, b) =>
        dateForSort(b.dataAtividade).localeCompare(dateForSort(a.dataAtividade)),
      );
      setAtividades(ordenadas);
    } catch (e) {
      toast({
        title: "Erro ao carregar atividades",
        description: e instanceof Error ? e.message : "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (obraId) carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obraId]);

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tipoContato) {
      toast({ title: "Selecione o tipo de contato", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const proxBR = semProximoContato ? "" : isoToBR(proximoContatoIso);
      const nova: Atividade = {
        idObra: obraId,
        dataAtividade: todayBR(),
        tipoContato,
        status: status.trim(),
        proximoContato: proxBR,
        comentario: comentario.trim(),
      };
      const salva = await criarAtividade(nova);
      setAtividades((prev) =>
        [salva, ...prev].sort((a, b) =>
          dateForSort(b.dataAtividade).localeCompare(dateForSort(a.dataAtividade)),
        ),
      );

      // Sincroniza com Follow-up da obra (aba Obras → coluna Próximo contato)
      if (proxBR) {
        try {
          await atualizarFollowUp(obraId, proxBR);
          setObra((prev) => (prev ? { ...prev, proximoContato: proxBR } : prev));
          toast({
            title: "Atividade registrada",
            description: `${salva.idAtividade} · Follow-up agendado para ${proxBR}`,
          });
        } catch (err) {
          toast({
            title: "Atividade salva, mas follow-up não sincronizou",
            description: err instanceof Error ? err.message : "Tente novamente",
            variant: "destructive",
          });
        }
      } else {
        toast({ title: "Atividade registrada", description: salva.idAtividade });
      }

      // reset
      setTipoContato("");
      setStatus("");
      setProximoContatoIso("");
      setComentario("");
      setSemProximoContato(false);
    } catch (e) {
      toast({
        title: "Erro ao salvar atividade",
        description: e instanceof Error ? e.message : "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (a: Atividade) => {
    setEditingId(a.idAtividade!);
    setEditForm({
      tipoContato: a.tipoContato,
      status: a.status,
      comentario: a.comentario,
      proximoContato: a.proximoContato,
    });
    setEditProxIso(brToIso(a.proximoContato || ""));
    setEditSemProx(!a.proximoContato);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
    setEditProxIso("");
    setEditSemProx(false);
  };

  const handleSalvarEdit = async (idAtividade: string) => {
    setEditSaving(true);
    try {
      const proxBR = editSemProx ? "" : isoToBR(editProxIso);
      const patch: Partial<Atividade> = {
        tipoContato: editForm.tipoContato || "",
        status: (editForm.status || "").trim(),
        comentario: (editForm.comentario || "").trim(),
        proximoContato: proxBR,
      };
      const atualizada = await atualizarAtividade(idAtividade, patch);
      setAtividades((prev) =>
        prev
          .map((a) => (a.idAtividade === idAtividade ? { ...a, ...atualizada } : a))
          .sort((a, b) =>
            dateForSort(b.dataAtividade).localeCompare(dateForSort(a.dataAtividade)),
          ),
      );

      // Se essa é a atividade mais recente E tem próximo contato, atualiza follow-up da obra
      const isMaisRecente = atividades[0]?.idAtividade === idAtividade;
      if (isMaisRecente && proxBR && proxBR !== obra?.proximoContato) {
        try {
          await atualizarFollowUp(obraId, proxBR);
          setObra((prev) => (prev ? { ...prev, proximoContato: proxBR } : prev));
        } catch {
          // silencioso
        }
      }

      toast({ title: "Atividade atualizada" });
      cancelEdit();
    } catch (e) {
      toast({
        title: "Erro ao atualizar",
        description: e instanceof Error ? e.message : "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setEditSaving(false);
    }
  };

  const handleExcluir = async (idAtividade: string) => {
    setDeletingId(idAtividade);
    try {
      await excluirAtividade(idAtividade);
      setAtividades((prev) => prev.filter((a) => a.idAtividade !== idAtividade));
      toast({ title: "Atividade excluída" });
    } catch (e) {
      toast({
        title: "Erro ao excluir",
        description: e instanceof Error ? e.message : "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  if (!obraId) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        ID da obra não informado.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
            <Link to="/">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Voltar
            </Link>
          </Button>
          <h1
            className="text-2xl font-bold text-foreground"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Atividades
          </h1>
          <p className="text-muted-foreground mt-1">
            <Badge variant="outline" className="mr-2 font-mono">{obraId}</Badge>
            {obra?.nome || "—"}
            {obra?.construtora ? ` · ${obra.construtora}` : ""}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* Histórico */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-4 w-4" />
              Histórico
              <Badge variant="secondary" className="ml-auto text-xs">
                {atividades.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : atividades.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">
                Nenhuma atividade registrada para esta obra.
              </p>
            ) : (
              <ul className="space-y-3">
                {atividades.map((a) => {
                  const Icon = tipoIcon(a.tipoContato);
                  const isEditing = editingId === a.idAtividade;
                  const isDeleting = deletingId === a.idAtividade;

                  if (isEditing) {
                    return (
                      <li
                        key={a.idAtividade}
                        className="border border-primary/40 rounded-lg p-3 bg-card space-y-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium text-muted-foreground">
                            Editando · {a.dataAtividade}
                          </span>
                          <span className="text-[10px] text-muted-foreground/60 font-mono">
                            {a.idAtividade}
                          </span>
                        </div>

                        <div>
                          <label className="text-xs font-medium text-muted-foreground">
                            Tipo de contato
                          </label>
                          <Select
                            value={editForm.tipoContato || ""}
                            onValueChange={(v) =>
                              setEditForm((p) => ({ ...p, tipoContato: v }))
                            }
                          >
                            <SelectTrigger className="mt-1 h-9">
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                            <SelectContent>
                              {TIPOS.map((t) => (
                                <SelectItem key={t.value} value={t.value}>
                                  {t.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <label className="text-xs font-medium text-muted-foreground">
                            Status
                          </label>
                          <Input
                            value={editForm.status || ""}
                            onChange={(e) =>
                              setEditForm((p) => ({ ...p, status: e.target.value }))
                            }
                            className="mt-1 h-9"
                          />
                        </div>

                        <div>
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-medium text-muted-foreground">
                              Próximo contato
                            </label>
                            <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer">
                              <input
                                type="checkbox"
                                checked={editSemProx}
                                onChange={(e) => {
                                  setEditSemProx(e.target.checked);
                                  if (e.target.checked) setEditProxIso("");
                                }}
                                className="h-3 w-3"
                              />
                              Sem próximo
                            </label>
                          </div>
                          <Input
                            type="date"
                            value={editProxIso}
                            onChange={(e) => setEditProxIso(e.target.value)}
                            disabled={editSemProx}
                            className="mt-1 h-9"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-medium text-muted-foreground">
                            Comentário
                          </label>
                          <Textarea
                            value={editForm.comentario || ""}
                            onChange={(e) =>
                              setEditForm((p) => ({ ...p, comentario: e.target.value }))
                            }
                            rows={3}
                            className="mt-1"
                          />
                        </div>

                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={cancelEdit}
                            disabled={editSaving}
                          >
                            <X className="h-3.5 w-3.5 mr-1" />
                            Cancelar
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleSalvarEdit(a.idAtividade!)}
                            disabled={editSaving}
                          >
                            {editSaving ? (
                              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                            ) : (
                              <Check className="h-3.5 w-3.5 mr-1" />
                            )}
                            Salvar
                          </Button>
                        </div>
                      </li>
                    );
                  }

                  return (
                    <li
                      key={a.idAtividade}
                      className="border border-border/60 rounded-lg p-3 bg-card hover:border-primary/30 transition-colors group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-primary" />
                          <span className="text-sm font-medium capitalize">
                            {a.tipoContato || "—"}
                          </span>
                          {a.status && (
                            <Badge variant="outline" className="text-xs">
                              {a.status}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {a.dataAtividade}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => startEdit(a)}
                            title="Editar"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                            onClick={() => setConfirmDeleteId(a.idAtividade!)}
                            disabled={isDeleting}
                            title="Excluir"
                          >
                            {isDeleting ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>
                      </div>
                      {a.comentario && (
                        <p className="text-sm text-foreground mt-2 whitespace-pre-wrap">
                          {a.comentario}
                        </p>
                      )}
                      {a.proximoContato && (
                        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                          <CalendarClock className="h-3 w-3" />
                          Próximo contato:{" "}
                          <span className="text-foreground">{a.proximoContato}</span>
                        </p>
                      )}
                      <p className="text-[10px] text-muted-foreground/60 mt-1 font-mono">
                        {a.idAtividade}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Nova atividade */}
        <Card className="h-fit lg:sticky lg:top-20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Plus className="h-4 w-4" />
              Nova atividade
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSalvar} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Tipo de contato *
                </label>
                <Select value={tipoContato} onValueChange={setTipoContato}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Status
                </label>
                <Input
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  placeholder="Ex: Em negociação"
                  className="mt-1"
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-muted-foreground">
                    Próximo contato
                  </label>
                  <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={semProximoContato}
                      onChange={(e) => {
                        setSemProximoContato(e.target.checked);
                        if (e.target.checked) setProximoContatoIso("");
                      }}
                      className="h-3 w-3"
                    />
                    Sem próximo contato
                  </label>
                </div>
                <Input
                  type="date"
                  value={proximoContatoIso}
                  onChange={(e) => setProximoContatoIso(e.target.value)}
                  disabled={semProximoContato}
                  className="mt-1"
                />
                {!semProximoContato && proximoContatoIso && (
                  <p className="text-[10px] text-muted-foreground/70 mt-1">
                    ✓ Será criado follow-up automático na obra
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Comentário
                </label>
                <Textarea
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                  placeholder="Detalhes da interação..."
                  rows={4}
                  className="mt-1"
                />
              </div>

              <div className="text-[11px] text-muted-foreground/70">
                <p>Obra: <span className="font-mono">{obraId}</span></p>
                <p>Data: {todayBR()} (preenchida automaticamente)</p>
              </div>

              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Registrar atividade
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <AlertDialog
        open={!!confirmDeleteId}
        onOpenChange={(open) => !open && setConfirmDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir atividade?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá permanentemente a atividade{" "}
              <span className="font-mono text-foreground">{confirmDeleteId}</span> da planilha.
              Não é possível desfazer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDeleteId && handleExcluir(confirmDeleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
