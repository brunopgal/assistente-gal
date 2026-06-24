import { Fragment, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listarObras, excluirObra, criarObra, atualizarObra, buscarObra, type Obra } from "@/services/obrasService";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Building2,
  Loader2,
  Search,
  ExternalLink,
  ListChecks,
  Pencil,
  Trash2,
  Info,
  Download,
  PlusCircle,
} from "lucide-react";
import ObraInfoDialog from "@/components/ObraInfoDialog";
import ObraForm, { type ObraFormValues } from "@/components/ObraForm";
import { useToast } from "@/hooks/use-toast";

import { normalizeText } from "@/lib/normalize";
import { exportarParaExcel } from "@/lib/exportXlsx";
import { STATUS_PROSPECCAO } from "@/lib/statusProspeccao";


const SHEETS_EXTERNAL_URL =
  "https://docs.google.com/spreadsheets/d/1cwVc4NwTrS5kx7q5Lt-RmTQ9WhnVhxbS3eBr3bJXv0g/edit?usp=sharing";

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  const s = (status || "").toLowerCase();
  if (s.includes("ganho") || s.includes("fechado")) return "default";
  if (s.includes("perdido")) return "destructive";
  if (s.includes("negocia")) return "secondary";
  return "outline";
}

function produtoColor(p: string): string {
  const s = p.toLowerCase();
  if (s.includes("prado")) return "text-orange-500 font-semibold";
  if (s.includes("imab")) return "text-foreground font-semibold";
  if (s.includes("rhoden") || s.includes("holding")) return "text-blue-500 font-semibold";
  return "";
}

export default function Obras() {
  const [obras, setObras] = useState<Obra[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filtroCidade, setFiltroCidade] = useState<string>("__all__");
  const [filtroProduto, setFiltroProduto] = useState<string>("__all__");
  const [filtroStatus, setFiltroStatus] = useState<string>("__all__");

  const [infoObra, setInfoObra] = useState<Obra | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Obra | null>(null);
  const [deleting, setDeleting] = useState(false);
  // ── Nova/Editar Obra Modal ───────────────────────────────────────────
  const [obraModalOpen, setObraModalOpen] = useState(false);
  const [obraModalEdit, setObraModalEdit] = useState<Obra | null>(null);
  const [modalDefaults, setModalDefaults] = useState<Partial<ObraFormValues> | undefined>();
  const [modalLoading, setModalLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  function openNovaObra() {
    setObraModalEdit(null);
    setModalDefaults(undefined);
    setObraModalOpen(true);
  }

  async function openEditObra(o: Obra) {
    const id = o.id || o.codigoObra || "";
    setObraModalEdit(o);
    setModalDefaults(o as unknown as Partial<ObraFormValues>);
    setObraModalOpen(true);
    if (id && /^OBRA\d{9}$/i.test(id)) {
      setModalLoading(true);
      try {
        const data = await buscarObra(id);
        setModalDefaults(data as unknown as Partial<ObraFormValues>);
      } catch {
        // usa dados da lista como fallback
      } finally {
        setModalLoading(false);
      }
    }
  }

  async function handleObraSubmit(values: ObraFormValues) {
    setIsSubmitting(true);
    try {
      const editId = obraModalEdit?.id || obraModalEdit?.codigoObra || "";
      if (editId) {
        await atualizarObra(editId, values as never);
        toast({ title: "Obra atualizada com sucesso" });
        setObras((prev) =>
          prev.map((x) =>
            (x.id || x.codigoObra) === editId ? { ...x, ...values } as Obra : x
          )
        );
      } else {
        const created = await criarObra(values as never);
        toast({ title: `Obra criada (${created.codigoObra || created.id})` });
        setObras((prev) => [created, ...prev]);
      }
      setObraModalOpen(false);
    } catch (err) {
      toast({
        title: "Erro ao salvar obra",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await listarObras();
        setObras(data);
      } catch (e) {
        toast({
          title: "Erro ao carregar obras",
          description: e instanceof Error ? e.message : "Tente novamente",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

  const cidadesDisponiveis = useMemo(() => {
    const set = new Set<string>();
    obras.forEach((o) => o.cidade && set.add(o.cidade.trim()));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [obras]);

  const produtosDisponiveis = useMemo(() => {
    const set = new Set<string>();
    obras.forEach((o) =>
      (o.produtoOferecido || "")
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean)
        .forEach((p) => set.add(p)),
    );
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [obras]);



  const filtradas = useMemo(() => {
    const q = normalizeText(query);
    const nCidade = normalizeText(filtroCidade);
    const nStatus = normalizeText(filtroStatus);
    const nProduto = normalizeText(filtroProduto);
    const result = obras.filter((o) => {
      if (
        q &&
        ![o.codigoObra, o.nome, o.construtora, o.responsavel, o.cidade, o.statusProspeccao]
          .filter(Boolean)
          .some((v) => normalizeText(v).includes(q))
      )
        return false;
      if (filtroCidade !== "__all__" && normalizeText(o.cidade) !== nCidade) return false;
      if (filtroStatus !== "__all__" && normalizeText(o.statusProspeccao) !== nStatus) return false;
      if (filtroProduto !== "__all__") {
        const prods = (o.produtoOferecido || "")
          .split(",")
          .map((p) => normalizeText(p))
          .filter(Boolean);
        if (!prods.includes(nProduto)) return false;
      }
      return true;
    });

    result.sort((a, b) => {
      const aDate = new Date((a as any).updated_at || a.dataCadastro || 0).getTime();
      const bDate = new Date((b as any).updated_at || b.dataCadastro || 0).getTime();
      return bDate - aDate;
    });

    return result;
  }, [obras, query, filtroCidade, filtroProduto, filtroStatus]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1
            className="text-2xl font-bold text-foreground flex items-center gap-2"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            <Building2 className="h-6 w-6 text-primary" />
            Obras
          </h1>
          <p className="text-muted-foreground mt-1">
            Acompanhe todas as obras e abra o histórico de atividades de cada uma
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportarParaExcel(filtradas as unknown as Record<string, unknown>[], "obras", "Obras")}
            disabled={loading || obras.length === 0}
          >
            <Download className="h-4 w-4 mr-1" />
            Exportar Excel
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={SHEETS_EXTERNAL_URL} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-1" />
              Abrir planilha
            </a>
          </Button>
          <Button size="sm" onClick={openNovaObra}>
            <PlusCircle className="h-4 w-4 mr-1" />
            Nova Obra
          </Button>
        </div>
      </div>




      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, ID, construtora, cidade..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="max-w-md"
            />
            <span className="text-xs text-muted-foreground ml-auto">
              {filtradas.length} de {obras.length}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-4">
            <Select value={filtroCidade} onValueChange={setFiltroCidade}>
              <SelectTrigger className="h-9 w-[180px]">
                <SelectValue placeholder="Cidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas as cidades</SelectItem>
                {cidadesDisponiveis.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filtroProduto} onValueChange={setFiltroProduto}>
              <SelectTrigger className="h-9 w-[180px]">
                <SelectValue placeholder="Produto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos os produtos</SelectItem>
                {produtosDisponiveis.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger className="h-9 w-[200px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos os status</SelectItem>
                {STATUS_PROSPECCAO.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(filtroCidade !== "__all__" || filtroProduto !== "__all__" || filtroStatus !== "__all__") && (
              <Button
                variant="ghost"
                size="sm"
                className="h-9"
                onClick={() => {
                  setFiltroCidade("__all__");
                  setFiltroProduto("__all__");
                  setFiltroStatus("__all__");
                }}
              >
                Limpar filtros
              </Button>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filtradas.length === 0 ? (
            <p className="text-center text-muted-foreground py-16">
              Nenhuma obra encontrada.
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">ID</TableHead>
                    <TableHead>Nome da obra</TableHead>
                    <TableHead className="hidden md:table-cell">Construtora</TableHead>
                    <TableHead className="hidden lg:table-cell">Cidade</TableHead>
                    <TableHead className="hidden lg:table-cell">Produtos</TableHead>
                    <TableHead className="hidden md:table-cell">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtradas.map((o) => (
                    <Fragment key={o.id || o.codigoObra}>
                      <TableRow className="border-b-0">
                        <TableCell className="font-mono text-xs">
                          {o.codigoObra}
                        </TableCell>
                        <TableCell className="font-medium">
                          {o.nome || "—"}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                          {o.construtora || "—"}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                          {o.cidade || "—"}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {o.produtoOferecido ? (
                            <div className="flex flex-wrap gap-1">
                              {o.produtoOferecido
                                .split(",")
                                .map((p) => p.trim())
                                .filter(Boolean)
                                .map((p) => (
                                  <Badge
                                    key={p}
                                    variant="outline"
                                    className={`text-xs ${produtoColor(p)}`}
                                  >
                                    {p}
                                  </Badge>
                                ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {o.statusProspeccao ? (
                            <div className="flex flex-col gap-1">
                              <Badge variant={statusVariant(o.statusProspeccao)} className="text-xs w-fit">
                                {o.statusProspeccao}
                              </Badge>
                              {/orçamento enviado|orcamento enviado/i.test(o.statusProspeccao) && (
                                <span className={`text-[11px] ${o.dataOrcamentoEnviado ? "text-muted-foreground" : "text-destructive"}`}>
                                  {o.dataOrcamentoEnviado ? o.dataOrcamentoEnviado : "Sem data — adicionar"}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell colSpan={6} className="pt-0 pb-3">
                          <div className="flex flex-wrap gap-1.5">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8"
                              onClick={() => setInfoObra(o)}
                            >
                              <Info className="h-3.5 w-3.5 mr-1" />
                              Informações
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8"
                              onClick={() => openEditObra(o)}
                            >
                              <Pencil className="h-3.5 w-3.5 mr-1" />
                              Editar
                            </Button>
                            <Button asChild variant="default" size="sm" className="h-8">
                              <Link to={`/atividades/${encodeURIComponent(o.id || o.codigoObra || "")}`}>
                                <ListChecks className="h-3.5 w-3.5 mr-1" />
                                Atividades
                              </Link>
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setConfirmDelete(o)}
                              title="Excluir obra"
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-1" />
                              Excluir
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Modal Nova/Editar Obra ── */}
      <Dialog open={obraModalOpen} onOpenChange={(o) => !o && !isSubmitting && setObraModalOpen(false)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {obraModalEdit ? `Editar Obra — ${obraModalEdit.codigoObra || obraModalEdit.id}` : "Nova Obra"}
            </DialogTitle>
          </DialogHeader>
          {modalLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <ObraForm
              key={(obraModalEdit?.id || obraModalEdit?.codigoObra || "new") + ":" + obraModalOpen}
              defaultValues={modalDefaults}
              onSubmit={handleObraSubmit}
              isSubmitting={isSubmitting}
              isEdit={!!obraModalEdit}
            />
          )}
        </DialogContent>
      </Dialog>



      <ObraInfoDialog
        open={!!infoObra}
        onOpenChange={(o) => !o && setInfoObra(null)}
        obraId={infoObra?.codigoObra || infoObra?.id || ""}
        obraInicial={infoObra}
      />

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && !deleting && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir obra?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A obra{" "}
              <strong>{confirmDelete?.nome || confirmDelete?.codigoObra}</strong> será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={async (e) => {
                e.preventDefault();
                if (!confirmDelete) return;
                const id = confirmDelete.id || confirmDelete.codigoObra || "";
                setDeleting(true);
                try {
                  await excluirObra(id);
                  setObras((prev) => prev.filter((x) => (x.id || x.codigoObra) !== id));
                  toast({ title: "Obra excluída" });
                  setConfirmDelete(null);
                } catch (err) {
                  toast({
                    title: "Erro ao excluir",
                    description: err instanceof Error ? err.message : "Tente novamente",
                    variant: "destructive",
                  });
                } finally {
                  setDeleting(false);
                }
              }}
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
