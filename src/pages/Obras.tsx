import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listarObras, type Obra } from "@/services/obrasService";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";
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

function getOrcamentoLink(o: Obra): { url: string; label: string } | null {
  if (o.linkOrcamentoPrado) return { url: o.linkOrcamentoPrado, label: "Prado" };
  if (o.linkOrcamentoImab) return { url: o.linkOrcamentoImab, label: "Imab" };
  if (o.linkOrcamentoRhoden) return { url: o.linkOrcamentoRhoden, label: "Rhoden" };
  return null;
}

function temBotaoOrcamento(status: string): boolean {
  const s = (status || "").toLowerCase();
  return s.includes("orçamento enviado") || s.includes("orcamento enviado") || s.includes("fechado");
}

export default function Obras() {
  const [obras, setObras] = useState<Obra[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
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
                    <TableHead className="w-[140px]">ID</TableHead>
                    <TableHead>Nome da obra</TableHead>
                    <TableHead className="hidden md:table-cell">Construtora</TableHead>
                    <TableHead className="hidden lg:table-cell">Cidade</TableHead>
                    <TableHead className="hidden md:table-cell">Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtradas.map((o) => (
                    <TableRow key={o.id || o.codigoObra}>
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
                      <TableCell className="hidden md:table-cell">
                        {o.statusProspeccao ? (
                          <Badge variant={statusVariant(o.statusProspeccao)} className="text-xs">
                            {o.statusProspeccao}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <Button asChild variant="ghost" size="sm" className="h-8">
                          <Link to={`/nova-obra?id=${encodeURIComponent(o.id || o.codigoObra || "")}`}>
                            <Pencil className="h-3.5 w-3.5 mr-1" />
                            Editar
                          </Link>
                        </Button>
                        <Button asChild variant="default" size="sm" className="h-8 ml-1">
                          <Link to={`/atividades/${encodeURIComponent(o.id || o.codigoObra || "")}`}>
                            <ListChecks className="h-3.5 w-3.5 mr-1" />
                            Atividades
                          </Link>
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
    </div>
  );
}
