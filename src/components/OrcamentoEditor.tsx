import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Plus,
  Trash2,
  Upload,
  Loader2,
  X,
  FileText,
  ExternalLink,
  Save,
  FileDown,
  Layers,
  AlertTriangle,
} from "lucide-react";
import {
  listarOrcamentosDaObra,
  criarOrcamentoPagina,
  atualizarOrcamento,
  excluirOrcamentoPagina,
  uploadArquivoOrcamento,
  type OrcamentoPagina,
  type BlocoOrcamento,
  type ArquivoOrcamento,
} from "@/services/orcamentosService";
import { useToast } from "@/hooks/use-toast";

interface OrcamentoEditorProps {
  codigoObra: string;
  obraNome: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function OrcamentoEditor({
  codigoObra,
  obraNome,
  open,
  onOpenChange,
}: OrcamentoEditorProps) {
  const { toast } = useToast();
  const [versões, setVersões] = useState<OrcamentoPagina[]>([]);
  const [versãoSelecionada, setVersãoSelecionada] = useState<OrcamentoPagina | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [uploadingBlockIdx, setUploadingBlockIdx] = useState<number | null>(null);

  // Campos locais da versão selecionada
  const [tituloVersao, setTituloVersao] = useState("");
  const [ativo, setAtivo] = useState(true);
  const [blocos, setBlocos] = useState<BlocoOrcamento[]>([]);

  // Carrega lista de versões da obra
  const carregarVersões = async () => {
    setLoadingList(true);
    try {
      const data = await listarOrcamentosDaObra(codigoObra);
      setVersões(data);
      if (data.length > 0) {
        // Seleciona a primeira por padrão
        selecionarVersão(data[0]);
      } else {
        setVersãoSelecionada(null);
      }
    } catch (error: any) {
      toast({
        title: "Erro ao carregar versões",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    if (open && codigoObra) {
      carregarVersões();
    }
  }, [open, codigoObra]);

  const selecionarVersão = (v: OrcamentoPagina) => {
    setVersãoSelecionada(v);
    setTituloVersao(v.titulo_versao || "");
    setAtivo(v.ativo ?? true);
    setBlocos(v.blocos || []);
  };

  // Cria uma nova versão
  const handleNovaVersão = async () => {
    const nomePadrao = `Versão ${versões.length + 1}`;
    setCreating(true);
    try {
      const nova = await criarOrcamentoPagina(codigoObra, nomePadrao);
      toast({ title: "Versão criada com sucesso!" });
      // Recarrega lista e seleciona a nova
      const atualizadas = await listarOrcamentosDaObra(codigoObra);
      setVersões(atualizadas);
      const selecionada = atualizadas.find((v) => v.id === nova.id) || nova;
      selecionarVersão(selecionada);
    } catch (error: any) {
      toast({
        title: "Erro ao criar versão",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  // Exclui versão
  const handleExcluirVersão = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Deseja realmente excluir esta versão de orçamento?")) return;

    setDeletingId(id);
    try {
      await excluirOrcamentoPagina(id);
      toast({ title: "Versão excluída!" });
      
      const atualizadas = versões.filter((v) => v.id !== id);
      setVersões(atualizadas);
      
      if (versãoSelecionada?.id === id) {
        if (atualizadas.length > 0) {
          selecionarVersão(atualizadas[0]);
        } else {
          setVersãoSelecionada(null);
        }
      }
    } catch (error: any) {
      toast({
        title: "Erro ao excluir versão",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  // Ativa um produto (adiciona bloco)
  const adicionarBloco = (produto: "Prado" | "Rohden" | "Imab" | "Outros") => {
    if (blocos.length >= 5) {
      toast({
        title: "Limite atingido",
        description: "Você pode adicionar no máximo 5 blocos de produtos por versão.",
        variant: "destructive",
      });
      return;
    }

    const novoBloco: BlocoOrcamento = {
      produto,
      titulo: `Orçamento referente a ${produto === "Outros" ? "itens diversos" : produto}`,
      arquivos: [],
      nome: produto === "Outros" ? "" : undefined,
    };

    setBlocos([...blocos, novoBloco]);
  };

  // Remove um bloco inteiro
  const removerBloco = (index: number) => {
    const novos = blocos.filter((_, idx) => idx !== index);
    setBlocos(novos);
  };

  // Atualiza um campo de um bloco
  const atualizarCampoBloco = (index: number, campo: keyof BlocoOrcamento, valor: any) => {
    const novos = [...blocos];
    novos[index] = { ...novos[index], [campo]: valor };
    setBlocos(novos);
  };

  // Upload de PDF para um bloco
  const handleUploadArquivo = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingBlockIdx(index);
    try {
      const novosArquivos: ArquivoOrcamento[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type !== "application/pdf") {
          toast({
            title: "Apenas PDFs são permitidos",
            description: `O arquivo ${file.name} não é um PDF.`,
            variant: "destructive",
          });
          continue;
        }
        const url = await uploadArquivoOrcamento(codigoObra, file);
        novosArquivos.push({ nome: file.name, url });
      }

      if (novosArquivos.length > 0) {
        const blocoAtual = blocos[index];
        const arquivosAtuais = blocoAtual.arquivos || [];
        atualizarCampoBloco(index, "arquivos", [...arquivosAtuais, ...novosArquivos]);
        toast({ title: "Arquivo(s) enviado(s) com sucesso!" });
      }
    } catch (error: any) {
      toast({
        title: "Erro ao enviar arquivo",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploadingBlockIdx(null);
      e.target.value = ""; // reseta
    }
  };

  // Remove arquivo de um bloco
  const removerArquivo = (blockIdx: number, fileIdx: number) => {
    const bloco = blocos[blockIdx];
    const novosArquivos = (bloco.arquivos || []).filter((_, idx) => idx !== fileIdx);
    atualizarCampoBloco(blockIdx, "arquivos", novosArquivos);
  };

  // Salva a versão atual
  const handleSalvar = async () => {
    if (!versãoSelecionada) return;

    // Validações básicas
    if (!tituloVersao.trim()) {
      toast({
        title: "Título obrigatório",
        description: "Digite um título para a versão do orçamento.",
        variant: "destructive",
      });
      return;
    }

    for (let i = 0; i < blocos.length; i++) {
      const b = blocos[i];
      if (b.produto === "Outros" && !b.nome?.trim()) {
        toast({
          title: "Nome do produto obrigatório",
          description: `Defina o nome do produto no bloco ${i + 1}.`,
          variant: "destructive",
        });
        return;
      }
    }

    setSaving(true);
    try {
      await atualizarOrcamento(versãoSelecionada.id, {
        titulo_versao: tituloVersao,
        ativo: ativo,
        blocos: blocos,
      });

      toast({ title: "Orçamento salvo com sucesso!" });
      // Atualiza na lista local sem re-query
      setVersões(
        versões.map((v) =>
          v.id === versãoSelecionada.id
            ? { ...v, titulo_versao: tituloVersao, ativo: ativo, blocos: blocos }
            : v
        )
      );
    } catch (error: any) {
      toast({
        title: "Erro ao salvar orçamento",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[85vh] flex flex-col p-0 overflow-hidden bg-background border border-border">
        <DialogHeader className="p-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl font-bold flex items-center gap-2 text-foreground">
                <Layers className="h-5 w-5 text-primary" />
                Editor de Orçamento
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-1">
                Obra: <span className="font-semibold text-foreground">{obraNome}</span> ({codigoObra})
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Corpo principal */}
        <div className="flex flex-1 overflow-hidden">
          {/* Barra Lateral: Versões */}
          <div className="w-64 border-r bg-muted/20 flex flex-col h-full shrink-0">
            <div className="p-4 border-b flex items-center justify-between gap-2 bg-muted/40">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Versões ({versões.length})
              </span>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs font-medium hover:bg-primary/5 hover:text-primary hover:border-primary/30 transition-all"
                onClick={handleNovaVersão}
                disabled={creating || loadingList}
              >
                {creating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                ) : (
                  <Plus className="h-3.5 w-3.5 mr-1" />
                )}
                Nova versão
              </Button>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {loadingList ? (
                  <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <span className="text-xs">Carregando versões...</span>
                  </div>
                ) : versões.length === 0 ? (
                  <div className="text-center py-10 text-xs text-muted-foreground">
                    Nenhuma versão criada.
                  </div>
                ) : (
                  versões.map((v) => {
                    const isSelected = versãoSelecionada?.id === v.id;
                    return (
                      <div
                        key={v.id}
                        className={`flex items-center justify-between p-3 rounded-md cursor-pointer transition-all ${
                          isSelected
                            ? "bg-primary/10 text-primary border-l-4 border-primary font-medium"
                            : "hover:bg-muted text-muted-foreground hover:text-foreground"
                        }`}
                        onClick={() => selecionarVersão(v)}
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <div className="text-sm truncate font-semibold">
                            {v.titulo_versao || "Sem título"}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                v.ativo ? "bg-emerald-500" : "bg-red-400"
                              }`}
                            />
                            <span className="text-[10px] uppercase">
                              {v.ativo ? "Ativa" : "Inativa"}
                            </span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded"
                          disabled={deletingId === v.id}
                          onClick={(e) => handleExcluirVersão(v.id, e)}
                        >
                          {deletingId === v.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Área Principal: Editor da versão selecionada */}
          <div className="flex-1 flex flex-col h-full bg-background overflow-hidden">
            {versãoSelecionada ? (
              <div className="flex-1 flex flex-col h-full overflow-hidden">
                {/* Scrollable Form */}
                <ScrollArea className="flex-1 p-6">
                  <div className="space-y-6 max-w-3xl">
                    {/* Linha 1: Dados da versão */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border rounded-lg bg-card/40">
                      <div className="md:col-span-2 space-y-2">
                        <Label htmlFor="titulo_versao" className="font-semibold">
                          Título da Versão
                        </Label>
                        <Input
                          id="titulo_versao"
                          value={tituloVersao}
                          onChange={(e) => setTituloVersao(e.target.value)}
                          placeholder="Ex: Proposta com Prado e Imab"
                          className="focus-visible:ring-primary"
                        />
                      </div>
                      <div className="flex flex-col justify-center items-start space-y-2.5 pl-2">
                        <span className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                          Status da Versão
                        </span>
                        <div className="flex items-center gap-2">
                          <Switch
                            id="versao-ativa"
                            checked={ativo}
                            onCheckedChange={setAtivo}
                          />
                          <Label htmlFor="versao-ativa" className="cursor-pointer text-xs">
                            {ativo ? (
                              <span className="text-emerald-600 font-semibold">Ativo (Exibido no Link)</span>
                            ) : (
                              <span className="text-muted-foreground">Inativo (Oculto)</span>
                            )}
                          </Label>
                        </div>
                      </div>
                    </div>

                    {/* Linha 2: Ativar Produtos */}
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-semibold text-foreground">
                          Ativar Produtos no Orçamento
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {blocos.length} de 5 blocos ativos
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(["Prado", "Rohden", "Imab", "Outros"] as const).map((prod) => {
                          const jaAtivo = blocos.some((b) => b.produto === prod && prod !== "Outros");
                          return (
                            <Button
                              key={prod}
                              type="button"
                              variant={jaAtivo ? "secondary" : "outline"}
                              size="sm"
                              disabled={blocos.length >= 5 || (jaAtivo && prod !== "Outros")}
                              onClick={() => adicionarBloco(prod)}
                              className="h-9 hover:border-primary/50 hover:bg-primary/5 transition-all text-xs"
                            >
                              <Plus className="h-3.5 w-3.5 mr-1" />
                              {prod}
                            </Button>
                          );
                        })}
                      </div>
                      {blocos.length >= 5 && (
                        <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/20 p-2 rounded border border-amber-200/50">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                          <span>Limite de 5 blocos atingido. Remova um bloco para adicionar outro.</span>
                        </div>
                      )}
                    </div>

                    {/* Blocos Ativos */}
                    <div className="space-y-4">
                      {blocos.length === 0 ? (
                        <div className="text-center py-10 border border-dashed rounded-lg text-muted-foreground text-sm space-y-1">
                          <div>Nenhum produto ativado nesta versão.</div>
                          <div className="text-xs text-muted-foreground/80">
                            Clique nos botões acima para ativar Prado, Rohden, Imab ou Outros.
                          </div>
                        </div>
                      ) : (
                        blocos.map((bloco, idx) => (
                          <Card key={`${bloco.produto}-${idx}`} className="border bg-card/30 relative hover:border-primary/20 transition-all">
                            <CardContent className="p-5 space-y-4">
                              {/* Cabeçalho do Bloco */}
                              <div className="flex items-center justify-between border-b pb-2">
                                <span className="font-semibold text-sm flex items-center gap-1.5 text-foreground">
                                  <Layers className="h-4 w-4 text-primary" />
                                  Bloco {idx + 1}: Produto {bloco.produto}
                                </span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removerBloco(idx)}
                                  className="h-8 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                >
                                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                                  Excluir bloco
                                </Button>
                              </div>

                              {/* Campos de texto */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                  <Label className="text-xs font-semibold">Título do Bloco</Label>
                                  <Input
                                    value={bloco.titulo}
                                    onChange={(e) => atualizarCampoBloco(idx, "titulo", e.target.value)}
                                    placeholder="Ex: Orçamento de Esquadrias"
                                    className="h-9"
                                  />
                                </div>
                                {bloco.produto === "Outros" && (
                                  <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold">Nome do Produto <span className="text-destructive">*</span></Label>
                                    <Input
                                      value={bloco.nome || ""}
                                      onChange={(e) => atualizarCampoBloco(idx, "nome", e.target.value)}
                                      placeholder="Ex: Ferragens Especiais"
                                      className="h-9"
                                    />
                                  </div>
                                )}
                              </div>

                              {/* Arquivos do Bloco */}
                              <div className="space-y-2 pt-1">
                                <Label className="text-xs font-semibold">Orçamentos em PDF</Label>
                                
                                {/* Lista de arquivos existentes */}
                                <div className="space-y-1.5">
                                  {(bloco.arquivos || []).map((file, fileIdx) => (
                                    <div
                                      key={`${file.url}-${fileIdx}`}
                                      className="flex items-center justify-between p-2 border rounded bg-muted/40 text-xs hover:bg-muted/70 transition-colors"
                                    >
                                      <div className="flex items-center gap-2 min-w-0 pr-4">
                                        <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                                        <a
                                          href={file.url}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="font-medium underline truncate hover:text-primary"
                                        >
                                          {file.nome}
                                        </a>
                                      </div>
                                      <div className="flex items-center gap-1.5 shrink-0">
                                        <a
                                          href={file.url}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="p-1 text-muted-foreground hover:text-foreground rounded"
                                          title="Visualizar arquivo"
                                        >
                                          <ExternalLink className="h-3.5 w-3.5" />
                                        </a>
                                        <button
                                          type="button"
                                          onClick={() => removerArquivo(idx, fileIdx)}
                                          className="p-1 text-muted-foreground hover:text-destructive rounded"
                                          title="Excluir arquivo"
                                        >
                                          <X className="h-3.5 w-3.5" />
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>

                                {/* Upload zone */}
                                <label className="flex items-center justify-center gap-2 p-3 border border-dashed rounded-md cursor-pointer hover:bg-muted/50 transition-colors text-xs text-muted-foreground">
                                  {uploadingBlockIdx === idx ? (
                                    <>
                                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                      <span>Enviando arquivo(s) PDF...</span>
                                    </>
                                  ) : (
                                    <>
                                      <Upload className="h-4 w-4 text-muted-foreground" />
                                      <span>Clique para subir orçamento(s) PDF</span>
                                    </>
                                  )}
                                  <input
                                    type="file"
                                    multiple
                                    accept=".pdf"
                                    className="hidden"
                                    onChange={(e) => handleUploadArquivo(idx, e)}
                                    disabled={uploadingBlockIdx !== null}
                                  />
                                </label>
                              </div>
                            </CardContent>
                          </Card>
                        ))
                      )}
                    </div>
                  </div>
                </ScrollArea>

                {/* Footer Fixo da área principal */}
                <div className="p-4 border-t flex justify-end gap-2 bg-muted/10 shrink-0">
                  <Button
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    disabled={saving}
                  >
                    Fechar
                  </Button>
                  <Button onClick={handleSalvar} disabled={saving} className="min-w-[100px]">
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Salvando
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Salvar
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-6 gap-2">
                <FileDown className="h-12 w-12 text-muted-foreground/30" />
                <div className="font-semibold text-sm">Nenhuma versão selecionada</div>
                <div className="text-xs">Selecione uma versão na barra lateral ou crie uma nova para começar.</div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
