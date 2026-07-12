import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ListChecks,
  Search,
  Building,
  Building2,
  Calendar,
  MessageSquare,
  Phone,
  Mail,
  Users,
  Clock,
  Loader2,
  ExternalLink,
  Download,
} from "lucide-react";
import { listarObras, type Obra } from "@/services/obrasService";
import { listarConstrutoras, type Construtora } from "@/services/construtorasService";
import { listarTodasAtividades, type Atividade } from "@/services/atividadesService";
import { listarTodasAtividadesConstrutoras, type AtividadeConstrutora } from "@/services/construtorasService";
import { listarPessoas, listarTodasAtividadesPessoas, type Pessoa, type AtividadePessoa } from "@/services/pessoasService";
import { extrairOrig } from "@/lib/atividadesUnificadas";
import { fetchAll } from "@/lib/supabaseFetchAll";
import * as XLSX from "xlsx";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface AtividadeUnificada {
  id: string;
  tipoOrigem: "obra" | "construtora" | "pessoa";
  origemId: string;
  origemNome: string;
  dataOriginal: string;
  dataISO: Date;
  tipoContato: string;
  tipoRegistro?: string; // atividade | visita | reuniao
  status: string;
  comentario: string;
  origIdEspelho?: string;
  idObra?: string;
  codigoConstrutora?: string;
  codigoPessoa?: string;
  horario?: string;
  criarFollowUp?: string;
  proximoContato?: string;
  created_at?: string;
  updated_at?: string;
}

function parseDataBr(dataStr: string): Date {
  if (!dataStr) return new Date(0);
  try {
    return parse(dataStr, "dd/MM/yyyy", new Date());
  } catch {
    return new Date(0);
  }
}

function formatDateTime(isoStr?: string): string {
  if (!isoStr) return "";
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch {
    return isoStr;
  }
}

function setupSheetMeta(ws: XLSX.WorkSheet, rowCount: number, colCount: number) {
  if (rowCount > 0 && colCount > 0) {
    ws['!autofilter'] = {
      ref: XLSX.utils.encode_range({
        s: { c: 0, r: 0 },
        e: { c: colCount - 1, r: rowCount }
      })
    };
  }
  ws['!views'] = [{ state: 'frozen', xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft' }];
}

export default function AtividadesGerais() {
  const [loading, setLoading] = useState(true);
  const [atividadesUnificadas, setAtividadesUnificadas] = useState<AtividadeUnificada[]>([]);
  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<string>("__all__");
  const [exportando, setExportando] = useState(false);

  async function handleExportExcel() {
    setExportando(true);
    try {
      const [obrasData, ctsData, atvsData, atvsCtsData, pessoasData, atvsPessData] = await Promise.all([
        fetchAll("obras", "codigoObra,nome"),
        fetchAll("construtoras", "codigo,nome"),
        fetchAll("atividades"),
        fetchAll("construtoras_atividades"),
        fetchAll("pessoas", "codigoPessoa,nome"),
        fetchAll("pessoas_atividades"),
      ]);

      const mapObras = new Map<string, string>();
      obrasData.forEach((o) => {
        if (o.codigoObra) mapObras.set(o.codigoObra, o.nome || "");
      });

      const mapCts = new Map<string, string>();
      ctsData.forEach((c) => {
        if (c.codigo) mapCts.set(c.codigo, c.nome || "");
      });

      const mapPessoas = new Map<string, string>();
      pessoasData.forEach((p) => {
        if (p.codigoPessoa) mapPessoas.set(p.codigoPessoa, p.nome || "");
      });

      const unificadas: AtividadeUnificada[] = [];

      atvsData.forEach((a) => {
        const nome = mapObras.get(a.idObra) || "Obra Desconhecida";
        unificadas.push({
          id: a.idAtividade || "",
          tipoOrigem: "obra",
          origemId: a.idObra,
          origemNome: nome,
          dataOriginal: a.dataAtividade,
          dataISO: parseDataBr(a.dataAtividade),
          tipoContato: a.tipoContato || "",
          status: a.status || "",
          comentario: a.comentario || "",
          idObra: a.idObra,
          codigoConstrutora: a.codigoConstrutora,
          codigoPessoa: a.codigoPessoa,
          origIdEspelho: extrairOrig(a.comentario || ""),
          horario: "",
          tipoRegistro: "atividade",
          criarFollowUp: "",
          proximoContato: a.proximoContato || "",
          created_at: a.created_at,
          updated_at: a.updated_at,
        });
      });

      atvsCtsData.forEach((a) => {
        const nome = mapCts.get(a.codigoConstrutora) || "Construtora Desconhecida";
        unificadas.push({
          id: a.idAtividade || "",
          tipoOrigem: "construtora",
          origemId: a.codigoConstrutora,
          origemNome: nome,
          dataOriginal: a.data,
          dataISO: parseDataBr(a.data),
          tipoContato: a.tipoContato || "",
          tipoRegistro: a.tipoRegistro,
          status: a.status || "",
          comentario: a.comentario || "",
          idObra: a.idObra,
          codigoConstrutora: a.codigoConstrutora,
          codigoPessoa: a.codigoPessoa,
          origIdEspelho: extrairOrig(a.comentario || ""),
          horario: a.horario || "",
          criarFollowUp: a.criarFollowUp || "",
          proximoContato: a.proximoContato || "",
          created_at: a.created_at,
          updated_at: a.updated_at,
        });
      });

      atvsPessData.forEach((a) => {
        const nome = mapPessoas.get(a.codigoPessoa) || "Contato Desconhecido";
        unificadas.push({
          id: a.idAtividade || "",
          tipoOrigem: "pessoa",
          origemId: a.codigoPessoa,
          origemNome: nome,
          dataOriginal: a.data,
          dataISO: parseDataBr(a.data),
          tipoContato: a.tipoContato || "",
          tipoRegistro: a.tipoRegistro,
          status: a.status || "",
          comentario: a.comentario || "",
          idObra: a.idObra,
          codigoConstrutora: a.codigoConstrutora,
          codigoPessoa: a.codigoPessoa,
          origIdEspelho: extrairOrig(a.comentario || ""),
          horario: a.horario || "",
          criarFollowUp: a.criarFollowUp || "",
          proximoContato: a.proximoContato || "",
          created_at: a.created_at,
          updated_at: a.updated_at,
        });
      });

      const idsPresentes = new Set(unificadas.map(x => x.id.toUpperCase()));
      const unicas = unificadas.filter(x => !(x.origIdEspelho && idsPresentes.has(x.origIdEspelho.toUpperCase())));

      unicas.sort((a, b) => b.dataISO.getTime() - a.dataISO.getTime());

      const wb = XLSX.utils.book_new();

      const headersAll = [
        "idAtividade", "origem", "data", "horario", "tipoRegistro", "tipoContato", 
        "status", "proximoContato", "comentario", "construtoraNome", "obraNome", 
        "pessoaNome", "codigoConstrutora", "idObra", "codigoPessoa", "criarFollowUp", 
        "created_at", "updated_at"
      ];

      const rowsAll = unicas.map(atv => ({
        idAtividade: atv.id,
        origem: atv.tipoOrigem,
        data: atv.dataOriginal || "",
        horario: atv.horario || "",
        tipoRegistro: atv.tipoRegistro || "",
        tipoContato: atv.tipoContato || "",
        status: atv.status || "",
        proximoContato: atv.proximoContato || "",
        comentario: atv.comentario || "",
        construtoraNome: mapCts.get(atv.codigoConstrutora || "") || "",
        obraNome: mapObras.get(atv.idObra || "") || "",
        pessoaNome: mapPessoas.get(atv.codigoPessoa || "") || "",
        codigoConstrutora: atv.codigoConstrutora || "",
        idObra: atv.idObra || "",
        codigoPessoa: atv.codigoPessoa || "",
        criarFollowUp: atv.criarFollowUp || "",
        created_at: formatDateTime(atv.created_at),
        updated_at: formatDateTime(atv.updated_at)
      }));

      const wsAll = XLSX.utils.json_to_sheet(rowsAll, { header: headersAll });
      setupSheetMeta(wsAll, rowsAll.length, headersAll.length);
      XLSX.utils.book_append_sheet(wb, wsAll, "Todas");

      const mapRawAtvs = (arr: any[]) => {
        if (arr.length === 0) return [{ aviso: "Sem registros" }];
        return arr.map(item => {
          const copy = { ...item };
          if (copy.created_at) copy.created_at = formatDateTime(copy.created_at);
          if (copy.updated_at) copy.updated_at = formatDateTime(copy.updated_at);
          return copy;
        });
      };

      const rowsObrasRaw = mapRawAtvs(atvsData);
      const wsObras = XLSX.utils.json_to_sheet(rowsObrasRaw);
      if (atvsData.length > 0) {
        const numCols = Object.keys(rowsObrasRaw[0]).length;
        setupSheetMeta(wsObras, rowsObrasRaw.length, numCols);
      }
      XLSX.utils.book_append_sheet(wb, wsObras, "Atividades Obras");

      const rowsCtsRaw = mapRawAtvs(atvsCtsData);
      const wsCts = XLSX.utils.json_to_sheet(rowsCtsRaw);
      if (atvsCtsData.length > 0) {
        const numCols = Object.keys(rowsCtsRaw[0]).length;
        setupSheetMeta(wsCts, rowsCtsRaw.length, numCols);
      }
      XLSX.utils.book_append_sheet(wb, wsCts, "Atividades Construtoras");

      const rowsPessRaw = mapRawAtvs(atvsPessData);
      const wsPess = XLSX.utils.json_to_sheet(rowsPessRaw);
      if (atvsPessData.length > 0) {
        const numCols = Object.keys(rowsPessRaw[0]).length;
        setupSheetMeta(wsPess, rowsPessRaw.length, numCols);
      }
      XLSX.utils.book_append_sheet(wb, wsPess, "Atividades Pessoas");

      const today = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `atividades_backup_${today}.xlsx`);
      toast.success("Excel de atividades gerado com sucesso!");
    } catch (err: any) {
      toast.error(`Falha ao exportar atividades: ${err.message}`);
    } finally {
      setExportando(false);
    }
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [obrasData, ctsData, atvsData, atvsCtsData, pessoasData, atvsPessData] = await Promise.all([
          listarObras().catch(() => [] as Obra[]),
          listarConstrutoras().catch(() => [] as Construtora[]),
          listarTodasAtividades().catch(() => [] as Atividade[]),
          listarTodasAtividadesConstrutoras().catch(() => [] as AtividadeConstrutora[]),
          listarPessoas().catch(() => [] as Pessoa[]),
          listarTodasAtividadesPessoas().catch(() => [] as AtividadePessoa[]),
        ]);

        const mapObras = new Map<string, string>();
        obrasData.forEach((o) => {
          if (o.codigoObra) mapObras.set(o.codigoObra, o.nome || "Obra Sem Nome");
          if (o.id) mapObras.set(o.id, o.nome || "Obra Sem Nome");
        });

        const mapCts = new Map<string, string>();
        ctsData.forEach((c) => {
          if (c.codigo) mapCts.set(c.codigo, c.nome || "Construtora Sem Nome");
        });

        const mapPessoas = new Map<string, string>();
        pessoasData.forEach((p) => {
          if (p.codigoPessoa) mapPessoas.set(p.codigoPessoa, p.nome || "Contato Sem Nome");
        });

        const unificadas: AtividadeUnificada[] = [];

        atvsData.forEach((a) => {
          const nome = mapObras.get(a.idObra) || "Obra Desconhecida";
          unificadas.push({
            id: a.idAtividade || Math.random().toString(),
            tipoOrigem: "obra",
            origemId: a.idObra,
            origemNome: nome,
            dataOriginal: a.dataAtividade,
            dataISO: parseDataBr(a.dataAtividade),
            tipoContato: a.tipoContato || "",
            status: a.status || "",
            comentario: a.comentario || "",
            idObra: a.idObra,
            codigoConstrutora: a.codigoConstrutora,
            codigoPessoa: a.codigoPessoa,
            origIdEspelho: extrairOrig(a.comentario || ""),
            horario: "",
            tipoRegistro: "atividade",
            criarFollowUp: "",
            proximoContato: a.proximoContato || "",
            created_at: (a as any).created_at,
            updated_at: (a as any).updated_at,
          });
        });

        atvsCtsData.forEach((a) => {
          const nome = mapCts.get(a.codigoConstrutora) || "Construtora Desconhecida";
          unificadas.push({
            id: a.idAtividade || Math.random().toString(),
            tipoOrigem: "construtora",
            origemId: a.codigoConstrutora,
            origemNome: nome,
            dataOriginal: a.data,
            dataISO: parseDataBr(a.data),
            tipoContato: a.tipoContato || "",
            tipoRegistro: a.tipoRegistro,
            status: a.status || "",
            comentario: a.comentario || "",
            idObra: a.idObra,
            codigoConstrutora: a.codigoConstrutora,
            codigoPessoa: a.codigoPessoa,
            origIdEspelho: extrairOrig(a.comentario || ""),
            horario: a.horario || "",
            criarFollowUp: a.criarFollowUp || "",
            proximoContato: a.proximoContato || "",
            created_at: (a as any).created_at,
            updated_at: (a as any).updated_at,
          });
        });

        atvsPessData.forEach((a) => {
          const nome = mapPessoas.get(a.codigoPessoa) || "Contato Desconhecido";
          unificadas.push({
            id: a.idAtividade || Math.random().toString(),
            tipoOrigem: "pessoa",
            origemId: a.codigoPessoa,
            origemNome: nome,
            dataOriginal: a.data,
            dataISO: parseDataBr(a.data),
            tipoContato: a.tipoContato || "",
            tipoRegistro: a.tipoRegistro,
            status: a.status || "",
            comentario: a.comentario || "",
            idObra: a.idObra,
            codigoConstrutora: a.codigoConstrutora,
            codigoPessoa: a.codigoPessoa,
            origIdEspelho: extrairOrig(a.comentario || ""),
            horario: a.horario || "",
            criarFollowUp: a.criarFollowUp || "",
            proximoContato: a.proximoContato || "",
            created_at: (a as any).created_at,
            updated_at: (a as any).updated_at,
          });
        });

        // Deduplicar: se a.origIdEspelho já existe na lista como id de outra atividade, remove
        const idsPresentes = new Set(unificadas.map(x => x.id.toUpperCase()));
        const unicas = unificadas.filter(x => !(x.origIdEspelho && idsPresentes.has(x.origIdEspelho.toUpperCase())));

        // Ordenar por data decrescente
        unicas.sort((a, b) => b.dataISO.getTime() - a.dataISO.getTime());

        setAtividadesUnificadas(unicas);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const getIconPorTipoContato = (tipoContato: string, tipoRegistro?: string) => {
    const t = (tipoContato || "").toLowerCase();
    if (tipoRegistro === "visita" || tipoRegistro === "reuniao") return <Users className="h-4 w-4 text-teal-500" />;
    if (t.includes("whatsapp")) return <MessageSquare className="h-4 w-4 text-emerald-500" />;
    if (t.includes("liga") || t.includes("telefone")) return <Phone className="h-4 w-4 text-blue-500" />;
    if (t.includes("email") || t.includes("e-mail")) return <Mail className="h-4 w-4 text-amber-500" />;
    if (t.includes("visita")) return <Users className="h-4 w-4 text-teal-500" />;
    return <ListChecks className="h-4 w-4 text-muted-foreground" />;
  };

  const filtradas = useMemo(() => {
    return atividadesUnificadas.filter((a) => {
      // Filtro de Busca
      if (busca) {
        const term = busca.toLowerCase();
        const nomeMatch = a.origemNome.toLowerCase().includes(term);
        const comentarioMatch = a.comentario.toLowerCase().includes(term);
        if (!nomeMatch && !comentarioMatch) return false;
      }
      
      // Filtro de Tipo
      if (filtroTipo !== "__all__") {
        const tc = a.tipoContato?.toLowerCase() || "";
        const tr = a.tipoRegistro?.toLowerCase() || "";
        if (filtroTipo === "whatsapp" && !tc.includes("whatsapp")) return false;
        if (filtroTipo === "ligacao" && !tc.includes("liga") && !tc.includes("telefone")) return false;
        if (filtroTipo === "email" && !tc.includes("email") && !tc.includes("e-mail")) return false;
        if (filtroTipo === "visita" && !tc.includes("visita") && tr !== "visita" && tr !== "reuniao") return false;
      }

      return true;
    });
  }, [atividadesUnificadas, busca, filtroTipo]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1
            className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            <ListChecks className="h-7 w-7 text-primary" />
            Atividades Gerais
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Histórico completo de todas as atividades de obras, construtoras e contatos.
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            onClick={handleExportExcel}
            disabled={exportando || loading}
            className="w-full sm:w-auto"
          >
            {exportando ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Exportando...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Exportar Excel
              </>
            )}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3 border-b border-border/50 bg-muted/20">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por obra, construtora ou comentário..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-9 bg-background"
              />
            </div>
            <div className="w-full sm:w-[200px]">
              <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Filtrar por tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos os tipos</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="ligacao">Ligação</SelectItem>
                  <SelectItem value="email">E-mail</SelectItem>
                  <SelectItem value="visita">Visita / Reunião</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filtradas.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="bg-muted h-12 w-12 rounded-full flex items-center justify-center mx-auto mb-3">
                <ListChecks className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium text-foreground">Nenhuma atividade encontrada</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Tente alterar os filtros ou limpar a busca.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {filtradas.map((atv) => (
                <div
                  key={`${atv.tipoOrigem}-${atv.id}`}
                  className="p-4 sm:p-5 hover:bg-muted/30 transition-colors flex flex-col sm:flex-row gap-4"
                >
                  <div className="shrink-0 pt-0.5 sm:w-32 flex sm:flex-col gap-2 sm:gap-1 items-center sm:items-start text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5 font-medium text-foreground/80">
                      <Calendar className="h-4 w-4" />
                      {atv.dataOriginal || "S/ Data"}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge
                            variant="secondary"
                            className={`text-[10px] uppercase font-semibold px-1.5 py-0 rounded ${
                              atv.tipoOrigem === "obra"
                                ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                                : atv.tipoOrigem === "construtora"
                                ? "bg-sky-500/10 text-sky-600 border-sky-500/20"
                                : "bg-purple-500/10 text-purple-600 border-purple-500/20"
                            }`}
                          >
                            {atv.tipoOrigem === "obra" ? (
                              <Building2 className="h-3 w-3 mr-1 inline" />
                            ) : atv.tipoOrigem === "construtora" ? (
                              <Building className="h-3 w-3 mr-1 inline" />
                            ) : (
                              <Users className="h-3 w-3 mr-1 inline" />
                            )}
                            {atv.tipoOrigem}
                          </Badge>
                          <span className="font-semibold text-foreground text-base leading-none">
                            {atv.origemNome}
                          </span>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" asChild className="h-8 w-8 shrink-0">
                        <Link
                          to={
                            atv.tipoOrigem === "obra"
                              ? `/atividades/${encodeURIComponent(atv.origemId)}`
                              : atv.tipoOrigem === "construtora"
                              ? `/construtoras?busca=${encodeURIComponent(atv.origemNome)}`
                              : `/pessoas?busca=${encodeURIComponent(atv.origemNome)}`
                          }
                          title={
                            atv.tipoOrigem === "obra"
                              ? "Ver histórico da obra"
                              : atv.tipoOrigem === "construtora"
                              ? "Ver construtora"
                              : "Ver contato"
                          }
                        >
                          <ExternalLink className="h-4 w-4 text-muted-foreground" />
                        </Link>
                      </Button>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-muted/50 px-2 py-1 rounded-md border border-border/50">
                        {getIconPorTipoContato(atv.tipoContato, atv.tipoRegistro)}
                        {atv.tipoRegistro === "visita" || atv.tipoRegistro === "reuniao"
                          ? atv.tipoRegistro.charAt(0).toUpperCase() + atv.tipoRegistro.slice(1)
                          : atv.tipoContato || "Sem tipo"}
                      </div>
                      {atv.status && (
                        <Badge variant="outline" className="text-[10px] font-normal rounded-sm">
                          {atv.status}
                        </Badge>
                      )}
                    </div>

                    {atv.comentario && (
                      <div className="text-sm text-foreground/90 bg-muted/20 p-3 rounded-md border border-border/30 whitespace-pre-wrap mt-2">
                        {atv.comentario}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
