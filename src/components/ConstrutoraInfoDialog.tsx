import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Info, ListChecks } from "lucide-react";
import { Link } from "react-router-dom";
import { listarObras, type Obra } from "@/services/obrasService";
import type { Construtora } from "@/services/construtorasService";
import ObraInfoDialog from "@/components/ObraInfoDialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  construtora: Construtora | null;
}

function norm(s: string) {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export default function ConstrutoraInfoDialog({ open, onOpenChange, construtora }: Props) {
  const [obras, setObras] = useState<Obra[]>([]);
  const [loading, setLoading] = useState(false);
  const [obraInfoId, setObraInfoId] = useState<string>("");
  const [obraInfoData, setObraInfoData] = useState<Obra | null>(null);

  useEffect(() => {
    if (!open || !construtora) return;
    setLoading(true);
    listarObras()
      .then((todas) => {
        const alvo = norm(construtora.nome);
        setObras(todas.filter((o) => norm(o.construtora) === alvo));
      })
      .catch(() => setObras([]))
      .finally(() => setLoading(false));
  }, [open, construtora]);

  if (!construtora) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {construtora.nome}
              {construtora.codigo && (
                <Badge variant="outline" className="font-mono text-xs">{construtora.codigo}</Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">CNPJ</div>
                <div>{construtora.cnpj || "—"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Status</div>
                <div>{construtora.status || "—"}</div>
              </div>
              <div className="col-span-2">
                <div className="text-xs text-muted-foreground">Produtos</div>
                {construtora.produto ? (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {construtora.produto.split(",").map((p) => p.trim()).filter(Boolean).map((p) => (
                      <Badge key={p} variant="outline" className="text-xs">{p}</Badge>
                    ))}
                  </div>
                ) : "—"}
              </div>
              {construtora.observacoes && (
                <div className="col-span-2">
                  <div className="text-xs text-muted-foreground">Observações</div>
                  <div className="whitespace-pre-wrap">{construtora.observacoes}</div>
                </div>
              )}
              {construtora.prospeccaoIA && (
                <div className="col-span-2">
                  <div className="text-xs text-muted-foreground">Prospecção IA</div>
                  <div className="whitespace-pre-wrap">{construtora.prospeccaoIA}</div>
                </div>
              )}
            </div>

            <div className="pt-2">
              <h3 className="font-semibold text-sm mb-2">
                Obras desta construtora {!loading && `(${obras.length})`}
              </h3>
              {loading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : obras.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Nenhuma obra vinculada a esta construtora.
                </p>
              ) : (
                <div className="space-y-2">
                  {obras.map((o) => (
                    <div
                      key={o.id || o.codigoObra}
                      className="border rounded-md p-3 flex items-start justify-between gap-2"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{o.nome || "—"}</div>
                        <div className="text-xs text-muted-foreground font-mono">{o.codigoObra}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Comprador: {o.responsavel || "—"}
                          {o.cidade && <> • {o.cidade}</>}
                          {o.statusProspeccao && <> • {o.statusProspeccao}</>}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7"
                          onClick={() => {
                            setObraInfoData(o);
                            setObraInfoId(o.codigoObra || o.id || "");
                          }}
                        >
                          <Info className="h-3.5 w-3.5 mr-1" /> Info
                        </Button>
                        <Button size="sm" variant="default" className="h-7" asChild>
                          <Link to={`/atividades/${encodeURIComponent(o.codigoObra || o.id || "")}`}>
                            <ListChecks className="h-3.5 w-3.5 mr-1" /> Ativ.
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ObraInfoDialog
        open={!!obraInfoId}
        onOpenChange={(o) => { if (!o) { setObraInfoId(""); setObraInfoData(null); } }}
        obraId={obraInfoId}
        obraInicial={obraInfoData}
      />
    </>
  );
}
