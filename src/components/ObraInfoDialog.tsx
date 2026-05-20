import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ExternalLink, Pencil, ListChecks } from "lucide-react";
import { buscarObra, type Obra } from "@/services/obrasService";
import { openFileSafe } from "@/lib/openFile";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  obraId: string;
  obraInicial?: Obra | null;
}

function Linha({ label, value, mono }: { label: string; value?: string; mono?: boolean }) {
  return (
    <div className="grid grid-cols-3 gap-2 py-1.5 border-b border-border/50 last:border-0">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`col-span-2 text-sm break-words ${mono ? "font-mono text-xs" : ""}`}>
        {value && value.trim() ? value : <span className="text-muted-foreground">—</span>}
      </div>
    </div>
  );
}

export default function ObraInfoDialog({ open, onOpenChange, obraId, obraInicial }: Props) {
  const [obra, setObra] = useState<Obra | null>(obraInicial || null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !obraId) return;
    if (obraInicial) {
      setObra(obraInicial);
      return;
    }
    setLoading(true);
    buscarObra(obraId)
      .then(setObra)
      .catch(() => setObra(null))
      .finally(() => setLoading(false));
  }, [open, obraId, obraInicial]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Informações da obra
            {obra?.codigoObra && (
              <Badge variant="outline" className="font-mono text-xs">{obra.codigoObra}</Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : !obra ? (
          <p className="text-center text-muted-foreground py-8">Obra não encontrada.</p>
        ) : (
          <div className="space-y-1">
            <Linha label="ID" value={obra.codigoObra} mono />
            <Linha label="Nome" value={obra.nome} />
            <Linha label="Construtora" value={obra.construtora} />
            <Linha label="Responsável/Comprador" value={obra.responsavel} />
            <Linha label="Telefone" value={obra.telefone} />
            <Linha label="Email" value={obra.email} />
            <Linha label="Cidade" value={obra.cidade} />
            <Linha label="Localização" value={obra.localizacao} />
            <Linha label="Classificação" value={obra.classificacao} />
            <Linha label="Estágio da obra" value={obra.estagioObra} />
            <Linha label="Status prospecção" value={obra.statusProspeccao} />
            <Linha label="Produtos oferecidos" value={obra.produtoOferecido} />
            <Linha label="Marcou reunião" value={obra.marcouReuniao} />
            <Linha label="Visita" value={obra.visita} />
            <Linha label="Data última visita" value={obra.dataUltimaVisita} />
            <Linha label="Data orçamento enviado" value={obra.dataOrcamentoEnviado} />
            <Linha label="Próximo contato" value={obra.proximoContato} />
            <Linha label="Data cadastro" value={obra.dataCadastro} />
            <Linha label="Concorrentes" value={obra.concorrentes} />
            <Linha label="Observações" value={obra.observacoes} />

            <div className="flex flex-wrap gap-2 pt-3">
              {([
                ["Prado", obra.linkOrcamentoPrado],
                ["Imab", obra.linkOrcamentoImab],
                ["Rhoden", obra.linkOrcamentoRhoden],
              ] as const).flatMap(([brand, raw]) => {
                const urls = (raw || "").split(",").map((s) => s.trim()).filter(Boolean);
                return urls.map((url, i) => (
                  <Button key={`${brand}-${i}`} size="sm" variant="outline" onClick={() => openFileSafe(url)}>
                    <ExternalLink className="h-3.5 w-3.5 mr-1" /> Orçamento {brand}{urls.length > 1 ? ` ${i + 1}` : ""}
                  </Button>
                ));
              })}
              <Button size="sm" variant="secondary" asChild>
                <Link to={`/nova-obra?id=${encodeURIComponent(obra.codigoObra || obra.id || "")}`}>
                  <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                </Link>
              </Button>
              <Button size="sm" asChild>
                <Link to={`/atividades/${encodeURIComponent(obra.codigoObra || obra.id || "")}`}>
                  <ListChecks className="h-3.5 w-3.5 mr-1" /> Atividades
                </Link>
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
