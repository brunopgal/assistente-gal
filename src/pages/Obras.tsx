import { Fragment, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listarObras, type Obra } from "@/services/obrasService";
import PautaReuniaoDialog from "@/components/PautaReuniaoDialog";
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
  FileText,
  CalendarClock,
  ClipboardList,
  Info,
} from "lucide-react";
import ObraInfoDialog from "@/components/ObraInfoDialog";
import { useToast } from "@/hooks/use-toast";
import { openFileSafe } from "@/lib/openFile";

const SHEETS_EXTERNAL_URL =
  "https://docs.google.com/spreadsheets/d/1cwVc4NwTrS5kx7q5Lt-RmTQ9WhnVhxbS3eBr3bJXv0g/edit?usp=sharing";

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  const s = (status || "").toLowerCase();
  if (s.includes("ganho") || s.includes("fechado")) return "default";
  if (s.includes("perdido")) return "destructive";
  if (s.includes("negocia")) return "secondary";
  return "outline";
}

function getOrcamentoLinks(o: Obra): { url: string; label: string }[] {
  const split = (v: string) => (v || "").split(",").map((s) => s.trim()).filter(Boolean);
  const out: { url: string; label: string }[] = [];
  const prado = split(o.linkOrcamentoPrado);
  const imab = split(o.linkOrcamentoImab);
  const rhoden = split(o.linkOrcamentoRhoden);
  prado.forEach((u, i) => out.push({ url: u, label: prado.length > 1 ? `Prado ${i + 1}` : "Prado" }));
  imab.forEach((u, i) => out.push({ url: u, label: imab.length > 1 ? `Imab ${i + 1}` : "Imab" }));
  rhoden.forEach((u, i) => out.push({ url: u, label: rhoden.length > 1 ? `Rhoden ${i + 1}` : "Rhoden" }));
  return out;
}

function temBotaoOrcamento(status: string): boolean {
  const s = (status || "").toLowerCase();
  return s.includes("orçamento enviado") || s.includes("orcamento enviado") || s.includes("fechado");
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
  const [pautaObra, setPautaObra] = useState<Obra | null>(null);
  const [infoObra, setInfoObra] = useState<Obra | null>(null);
  const { toast } = useToast();

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

  const filtradas = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return obras;
    return obras.filter((o) =>
      [o.codigoObra, o.nome, o.construtora, o.responsavel, o.cidade, o.statusProspeccao]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [obras, query]);

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
        <Button variant="outline" size="sm" asChild>
          <a href={SHEETS_EXTERNAL_URL} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4 mr-1" />
            Abrir planilha
          </a>
        </Button>
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
                            {temBotaoOrcamento(o.statusProspeccao) &&
                              getOrcamentoLinks(o).map((orc, idx) => (
                                <Button
                                  key={`${orc.url}-${idx}`}
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-8"
                                  onClick={() => openFileSafe(orc.url)}
                                  title={`Abrir orçamento ${orc.label}`}
                                >
                                  <FileText className="h-3.5 w-3.5 mr-1" />
                                  {orc.label}
                                </Button>
                              ))}
                            <Button asChild variant="ghost" size="sm" className="h-8">
                              <Link to={`/nova-obra?id=${encodeURIComponent(o.id || o.codigoObra || "")}`}>
                                <Pencil className="h-3.5 w-3.5 mr-1" />
                                Editar
                              </Link>
                            </Button>
                            <Button asChild variant="outline" size="sm" className="h-8">
                              <Link to={`/visitas?obra=${encodeURIComponent(o.id || o.codigoObra || "")}`}>
                                <CalendarClock className="h-3.5 w-3.5 mr-1" />
                                Visita/Reunião
                              </Link>
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="h-8"
                              onClick={() => setPautaObra(o)}
                            >
                              <ClipboardList className="h-3.5 w-3.5 mr-1" />
                              Pauta Reunião
                            </Button>
                            <Button asChild variant="default" size="sm" className="h-8">
                              <Link to={`/atividades/${encodeURIComponent(o.id || o.codigoObra || "")}`}>
                                <ListChecks className="h-3.5 w-3.5 mr-1" />
                                Atividades
                              </Link>
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

      <PautaReuniaoDialog
        open={!!pautaObra}
        onOpenChange={(o) => !o && setPautaObra(null)}
        obraId={pautaObra?.id || pautaObra?.codigoObra || ""}
        obraNome={pautaObra?.nome}
      />

      <ObraInfoDialog
        open={!!infoObra}
        onOpenChange={(o) => !o && setInfoObra(null)}
        obraId={infoObra?.codigoObra || infoObra?.id || ""}
        obraInicial={infoObra}
      />
    </div>
  );
}
