import { useEffect, useState, useMemo } from "react";
import { listarTodosOrcamentos, type OrcamentoPagina } from "@/services/orcamentosService";
import { listarObras, type Obra } from "@/services/obrasService";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Plus,
  Search,
  Layers,
  Building2,
  Calendar,
  FileText,
  CheckCircle2,
  XCircle,
  FolderOpen,
  ArrowRightLeft,
} from "lucide-react";
import OrcamentoEditor from "@/components/OrcamentoEditor";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface ObraComOrcamento {
  codigoObra: string;
  obra?: Obra;
  versoes: OrcamentoPagina[];
}

export default function Orcamentos() {
  const { toast } = useToast();
  const [obras, setObras] = useState<Obra[]>([]);
  const [orcamentos, setOrcamentos] = useState<OrcamentoPagina[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeObraForOrcamento, setActiveObraForOrcamento] = useState<Obra | null>(null);

  // Estados para abertura de novo orçamento
  const [novoOrcamentoOpen, setNovoOrcamentoOpen] = useState(false);
  const [selectedObraId, setSelectedObraId] = useState("");
  const [obraComboboxOpen, setObraComboboxOpen] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ops, orcs] = await Promise.all([listarObras(), listarTodosOrcamentos()]);
      setObras(ops || []);
      setOrcamentos(orcs || []);
    } catch (e: any) {
      toast({
        title: "Erro ao carregar dados",
        description: e.message || "Tente novamente mais tarde",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const mapObras = useMemo(() => {
    return obras.reduce((acc, o) => {
      acc[o.codigoObra || o.id!] = o;
      return acc;
    }, {} as Record<string, Obra>);
  }, [obras]);

  const filteredObrasComOrcamentos = useMemo(() => {
    // 1. Agrupa os orçamentos por codigo_obra
    const groups: Record<string, ObraComOrcamento> = {};

    orcamentos.forEach((orc) => {
      const cod = orc.codigo_obra;
      if (!groups[cod]) {
        groups[cod] = {
          codigoObra: cod,
          obra: mapObras[cod],
          versoes: [],
        };
      }
      groups[cod].versoes.push(orc);
    });

    const list = Object.values(groups);

    // 2. Filtra pela busca
    const q = searchTerm.toLowerCase().trim();
    if (!q) return list;

    return list.filter((item) => {
      const matchObraName = item.obra?.nome?.toLowerCase().includes(q);
      const matchConstrutora = item.obra?.construtora?.toLowerCase().includes(q);
      const matchCodigo = item.codigoObra?.toLowerCase().includes(q);
      const matchVersao = item.versoes.some((v) =>
        v.titulo_versao?.toLowerCase().includes(q)
      );

      return matchObraName || matchConstrutora || matchCodigo || matchVersao;
    });
  }, [orcamentos, mapObras, searchTerm]);

  const handleAbrirEditor = (obra: Obra) => {
    setActiveObraForOrcamento(obra);
  };

  const handleCriarOrcamento = () => {
    if (!selectedObraId) {
      toast({
        title: "Seleção obrigatória",
        description: "Selecione uma obra para gerenciar o orçamento.",
        variant: "destructive",
      });
      return;
    }
    const selected = obras.find((o) => (o.codigoObra || o.id) === selectedObraId);
    if (selected) {
      setActiveObraForOrcamento(selected);
      setNovoOrcamentoOpen(false);
      setSelectedObraId("");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1
            className="text-2xl font-bold text-foreground"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Páginas de Orçamentos
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gerencie as versões e páginas públicas de orçamentos vinculados a cada obra.
          </p>
        </div>
        <Button onClick={() => setNovoOrcamentoOpen(true)} className="shadow-sm">
          <Plus className="h-4 w-4 mr-2" />
          Novo Orçamento de Obra
        </Button>
      </div>

      {/* Busca */}
      <div className="flex items-center gap-2 max-w-sm">
        <div className="relative w-full">
          <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            className="pl-9 bg-card/50"
            placeholder="Buscar por obra, construtora ou versão..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Grid de Obras com Orçamentos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredObrasComOrcamentos.map((item) => {
          const { obra, codigoObra, versoes } = item;
          const totalVersoes = versoes.length;
          const temVersaoAtiva = versoes.some((v) => v.ativo);

          return (
            <Card
              key={codigoObra}
              className="hover:shadow-md transition-all duration-200 border-border bg-card/60 flex flex-col justify-between"
            >
              <CardContent className="p-5 space-y-4 flex-1">
                {/* Nome da obra e Construtora */}
                <div className="space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-foreground line-clamp-1">
                      {obra?.nome || "Obra Sem Nome"}
                    </h3>
                    <Badge
                      variant={temVersaoAtiva ? "default" : "secondary"}
                      className="text-[9px] uppercase tracking-wider font-semibold shrink-0"
                    >
                      {temVersaoAtiva ? "Possui Ativo" : "Inativo"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5 truncate">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    {obra?.construtora || "Sem construtora vinculada"}
                  </p>
                  <p className="text-[10px] text-muted-foreground font-mono">
                    Código: {codigoObra}
                  </p>
                </div>

                {/* Lista de Versões */}
                <div className="space-y-2 pt-2 border-t">
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex justify-between">
                    <span>Versões de Páginas</span>
                    <span>{totalVersoes}</span>
                  </div>

                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {versoes.map((v) => (
                      <div
                        key={v.id}
                        className="flex items-center justify-between p-2 rounded bg-muted/30 text-xs border border-border/40"
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <span className="font-semibold text-foreground truncate block">
                            {v.titulo_versao || "Sem Título"}
                          </span>
                          <span className="text-[9px] text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Calendar className="h-3 w-3 shrink-0" />
                            {v.created_at
                              ? new Date(v.created_at).toLocaleDateString("pt-BR")
                              : "—"}
                          </span>
                        </div>
                        <Badge
                          variant={v.ativo ? "default" : "outline"}
                          className="text-[8px] uppercase px-1.5 py-0"
                        >
                          {v.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>

              {/* Botão de Ação */}
              <div className="p-4 pt-0 border-t bg-muted/5 rounded-b-lg">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs font-semibold mt-3 hover:bg-primary/5 hover:text-primary hover:border-primary/40 transition-colors"
                  onClick={() =>
                    handleAbrirEditor(
                      obra || {
                        codigoObra,
                        nome: "Obra Desconhecida",
                        dataCadastro: "",
                        statusProspeccao: "",
                        classificacao: "",
                        construtora: "",
                        responsavel: "",
                        telefone: "",
                        email: "",
                        cidade: "",
                        localizacao: "",
                        produtoOferecido: "",
                        estagioObra: "",
                        marcouReuniao: "",
                        visita: "",
                        dataUltimaVisita: "",
                        dataOrcamentoEnviado: "",
                        proximoContato: "",
                        linkOrcamentoRhoden: "",
                        linkOrcamentoPrado: "",
                        linkOrcamentoImab: "",
                        observacoes: "",
                        concorrentes: "",
                      }
                    )
                  }
                >
                  <FolderOpen className="h-3.5 w-3.5 mr-1.5" />
                  Abrir Editor de Orçamentos
                </Button>
              </div>
            </Card>
          );
        })}

        {filteredObrasComOrcamentos.length === 0 && (
          <div className="col-span-full py-16 text-center text-muted-foreground border border-dashed rounded-lg bg-card/25 flex flex-col items-center justify-center gap-2">
            <FolderOpen className="h-10 w-10 text-muted-foreground/35" />
            <div className="font-semibold text-sm">Nenhum orçamento encontrado</div>
            <div className="text-xs">
              Clique em "Novo Orçamento de Obra" para iniciar uma versão para alguma obra.
            </div>
          </div>
        )}
      </div>

      {/* Dialog para Novo Orçamento (Escolher Obra) */}
      <Dialog open={novoOrcamentoOpen} onOpenChange={setNovoOrcamentoOpen}>
        <DialogContent className="max-w-md bg-background border border-border">
          <DialogHeader>
            <DialogTitle>Selecionar Obra para Orçamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Selecione uma obra</Label>
              <Popover open={obraComboboxOpen} onOpenChange={setObraComboboxOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between font-normal text-left truncate bg-card"
                  >
                    {selectedObraId
                      ? obras.find((o) => (o.codigoObra || o.id) === selectedObraId)?.nome
                      : "Escolha uma obra..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[380px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar obra..." />
                    <CommandList>
                      <CommandEmpty>Nenhuma obra encontrada.</CommandEmpty>
                      <CommandGroup>
                        {obras.map((o) => {
                          const code = o.codigoObra || o.id!;
                          return (
                            <CommandItem
                              key={code}
                              value={o.nome}
                              onSelect={() => {
                                setSelectedObraId(code);
                                setObraComboboxOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedObraId === code ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <span className="truncate">{o.nome}</span>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t mt-4">
              <Button variant="ghost" onClick={() => setNovoOrcamentoOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCriarOrcamento} disabled={!selectedObraId}>
                Abrir Editor
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Editor Dialog */}
      {activeObraForOrcamento && (
        <OrcamentoEditor
          codigoObra={activeObraForOrcamento.codigoObra || activeObraForOrcamento.id || ""}
          obraNome={activeObraForOrcamento.nome}
          open={!!activeObraForOrcamento}
          onOpenChange={(open) => {
            if (!open) {
              setActiveObraForOrcamento(null);
              fetchData(); // recarrega para pegar modificações
            }
          }}
        />
      )}
    </div>
  );
}
