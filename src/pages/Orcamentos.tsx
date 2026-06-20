import { useEffect, useState, useMemo } from "react";
import { listarOrcamentos, atualizarStatusOrcamento, criarOrcamento, type Orcamento, type StatusOrcamento, type ProdutoOrcamento } from "@/services/orcamentosService";
import { listarObras, atualizarCampoObra, type Obra } from "@/services/obrasService";
import { criarAtividade } from "@/services/atividadesService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, MoreVertical, ExternalLink, Calendar, Search, FileText } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import MultiFileUploadField from "@/components/MultiFileUploadField";

function parseDate(str: string): Date | null {
  if (!str) return null;
  const iso = new Date(str);
  if (!isNaN(iso.getTime())) return iso;
  return null;
}

function diffDays(from: Date, to: Date): number {
  from.setHours(0, 0, 0, 0);
  to.setHours(0, 0, 0, 0);
  return Math.floor((to.getTime() - from.getTime()) / (1000 * 3600 * 24));
}

function statusColor(status: StatusOrcamento) {
  switch (status) {
    case "Enviado": return "default";
    case "Em Análise": return "secondary";
    case "Aprovado": return "success";
    case "Recusado": return "destructive";
    default: return "outline";
  }
}

export default function Orcamentos() {
  const [obras, setObras] = useState<Obra[]>([]);
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [novaIdObra, setNovaIdObra] = useState("");
  const [novoProduto, setNovoProduto] = useState<ProdutoOrcamento | "">("");
  const [novoValor, setNovoValor] = useState("");
  const [novoLink, setNovoLink] = useState("");
  const [novaData, setNovaData] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [obraComboboxOpen, setObraComboboxOpen] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ops, orcs] = await Promise.all([listarObras(), listarOrcamentos()]);
      setObras(ops);
      setOrcamentos(orcs);
    } catch (e: any) {
      toast({ title: "Erro ao carregar dados", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSalvar = async () => {
    if (!novaIdObra || !novoProduto || !novaData) {
      toast({ title: "Preencha obra, produto e data", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const selectedObra = obras.find(o => (o.codigoObra || o.id) === novaIdObra);
      const valNum = parseFloat(novoValor.replace(",", "."));
      
      const newOrc: Orcamento = {
        codigoObra: novaIdObra,
        produto: novoProduto,
        valor: isNaN(valNum) ? null : valNum,
        link_anexo: novoLink,
        data_envio: novaData,
        status: "Enviado",
      };

      await criarOrcamento(newOrc);

      // Atualiza status da obra e cria atividade conforme a regra rígida
      if (selectedObra) {
        await atualizarCampoObra(novaIdObra, "statusProspeccao", "Orçamento Enviado");
        
        // Data no formato BR para atividade (DD/MM/YYYY)
        const d = new Date(novaData);
        d.setMinutes(d.getMinutes() + d.getTimezoneOffset()); // adjust local timezone issue for input date
        const dataBr = `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
        
        await criarAtividade({
          idObra: novaIdObra,
          dataAtividade: dataBr,
          tipoContato: "orcamento", // tipo de atividade EXATO
          status: "Realizado",
          proximoContato: "",
          comentario: `Orçamento da marca ${novoProduto} enviado${!isNaN(valNum) ? ' (R$ ' + valNum.toFixed(2) + ')' : ''}.`,
        });
      }

      toast({ title: "Orçamento salvo e vinculado com sucesso!" });
      setModalOpen(false);
      fetchData(); // recarrega
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSaving(true);
    }
  };

  const handleMudarStatus = async (id: string, status: StatusOrcamento) => {
    try {
      await atualizarStatusOrcamento(id, status);
      setOrcamentos(prev => prev.map(o => o.id === id ? { ...o, status } : o));
      toast({ title: "Status atualizado" });
    } catch (e) {
      toast({ title: "Erro ao atualizar", variant: "destructive" });
    }
  };

  const mapObras = useMemo(() => {
    return obras.reduce((acc, o) => {
      acc[o.codigoObra || o.id!] = o;
      return acc;
    }, {} as Record<string, Obra>);
  }, [obras]);

  const filteredOrcamentos = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return orcamentos.filter(orc => {
      const obra = mapObras[orc.codigoObra];
      const matchObra = obra?.nome?.toLowerCase().includes(q);
      const matchProduto = orc.produto.toLowerCase().includes(q);
      return !q || matchObra || matchProduto;
    });
  }, [orcamentos, searchTerm, mapObras]);

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Orçamentos</h1>
          <p className="text-muted-foreground text-sm mt-1">Acompanhe todos os orçamentos enviados</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Orçamento
        </Button>
      </div>

      <div className="flex items-center gap-2 max-w-sm">
        <Search className="h-4 w-4 text-muted-foreground absolute ml-3" />
        <Input 
          className="pl-9" 
          placeholder="Buscar obra ou produto..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredOrcamentos.map(orc => {
          const obra = mapObras[orc.codigoObra];
          const dt = parseDate(orc.data_envio);
          const dias = dt ? diffDays(dt, new Date()) : 0;
          
          return (
            <Card key={orc.id} className="hover:border-primary/30 transition-colors">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-foreground truncate">{obra?.nome || "Obra Desconhecida"}</h3>
                    <p className="text-xs text-muted-foreground truncate">{obra?.construtora || "Sem construtora"}</p>
                  </div>
                  <Badge variant={statusColor(orc.status)} className="shrink-0 text-[10px] uppercase">
                    {orc.status}
                  </Badge>
                </div>

                <div className="bg-muted/50 rounded-md p-2 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Produto:</span>
                    <span className="font-medium">{orc.produto}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Valor:</span>
                    <span className="font-medium">
                      {orc.valor ? `R$ ${orc.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t border-border/50 mt-1">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      <span className="text-xs">{orc.data_envio ? new Date(orc.data_envio + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}</span>
                    </div>
                    {dias > 0 && <span className="text-xs text-orange-600 font-medium">{dias} dias atrás</span>}
                    {dias === 0 && <span className="text-xs text-emerald-600 font-medium">Hoje</span>}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  {orc.link_anexo ? (
                    <Button variant="outline" size="sm" asChild className="h-8 text-xs">
                      <a href={orc.link_anexo} target="_blank" rel="noreferrer">
                        <FileText className="h-3.5 w-3.5 mr-1" /> Ver Anexo
                      </a>
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">Sem anexo</span>
                  )}

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleMudarStatus(orc.id!, "Enviado")}>Marcar como Enviado</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleMudarStatus(orc.id!, "Em Análise")}>Marcar como Em Análise</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleMudarStatus(orc.id!, "Aprovado")}>Marcar como Aprovado</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleMudarStatus(orc.id!, "Recusado")} className="text-red-600">Marcar como Recusado</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {filteredOrcamentos.length === 0 && (
          <div className="col-span-full py-12 text-center text-muted-foreground border border-dashed rounded-lg">
            Nenhum orçamento encontrado.
          </div>
        )}
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Orçamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Obra</Label>
              <Popover open={obraComboboxOpen} onOpenChange={setObraComboboxOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between font-normal text-left truncate">
                    {novaIdObra ? obras.find((o) => (o.codigoObra || o.id) === novaIdObra)?.nome : "Selecione uma obra..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0" align="start">
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
                              onSelect={() => { setNovaIdObra(code); setObraComboboxOpen(false); }}
                            >
                              <Check className={cn("mr-2 h-4 w-4", novaIdObra === code ? "opacity-100" : "opacity-0")} />
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

            <div className="space-y-2">
              <Label>Produto</Label>
              <Select value={novoProduto} onValueChange={(v) => setNovoProduto(v as ProdutoOrcamento)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o produto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Prado">Prado</SelectItem>
                  <SelectItem value="Rohden">Rohden</SelectItem>
                  <SelectItem value="Imab">Imab</SelectItem>
                  <SelectItem value="Outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Valor Total (Opcional)</Label>
              <Input type="number" placeholder="Ex: 50000" value={novoValor} onChange={(e) => setNovoValor(e.target.value)} />
            </div>

            <MultiFileUploadField
              label="Anexos do Orçamento (Máx 7)"
              value={novoLink}
              onChange={(v) => setNovoLink(v)}
              maxFiles={7}
            />

            <div className="space-y-2">
              <Label>Data de Envio</Label>
              <Input type="date" value={novaData} onChange={(e) => setNovaData(e.target.value)} />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Button>
              <Button onClick={handleSalvar} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
