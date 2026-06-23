import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  buscarOrcamentoPorToken,
  buscarObraPorCodigoPublico,
  type OrcamentoPagina,
} from "@/services/orcamentosService";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  FileText,
  Eye,
  Download,
  Building2,
  AlertCircle,
  ShieldCheck,
  ChevronRight,
} from "lucide-react";

export default function OrcamentoPublico() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [orcamento, setOrcamento] = useState<OrcamentoPagina | null>(null);
  const [obra, setObra] = useState<any | null>(null);
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);

  useEffect(() => {
    const fetchPublicData = async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const data = await buscarOrcamentoPorToken(token);
        if (data && data.ativo) {
          setOrcamento(data);
          // Tenta buscar a obra associada
          if (data.codigo_obra) {
            const obraData = await buscarObraPorCodigoPublico(data.codigo_obra);
            setObra(obraData);
          }
        }
      } catch (error) {
        console.error("Erro ao buscar dados públicos do orçamento:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPublicData();
  }, [token]);

  // Registra a abertura do orçamento uma única vez após o carregamento bem-sucedido e ativo
  useEffect(() => {
    if (orcamento && orcamento.ativo && token) {
      const registrarAbertura = async () => {
        try {
          await supabase.functions.invoke("registrar-abertura", {
            body: { token, tipo: "orcamento" },
          });
        } catch (error) {
          // Falha silenciosa: ignora o erro conforme requisito fire-and-forget
          console.warn("Falha silenciosa ao registrar abertura:", error);
        }
      };
      registrarAbertura();
    }
  }, [orcamento?.id, token]);

  // Função robusta de download para forçar o download no navegador
  const handleDownload = async (url: string, filename: string) => {
    setDownloadingFile(url);
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const baseBlob = await response.blob();
      
      // Converte para octet-stream para tentar forçar o download no celular/Safari/Chrome móvel
      const blob = new Blob([baseBlob], { type: "application/octet-stream" });
      const blobUrl = window.URL.createObjectURL(blob);
      
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      
      // Essencial anexar ao documento no mobile para disparar o evento click
      document.body.appendChild(link);
      link.click();
      
      // Aguarda um pequeno delay e limpa os recursos
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
      }, 100);
    } catch (error) {
      console.warn("Download via blob falhou, tentando fallback direto:", error);
      // Fallback para download direto caso CORS impeça fetch
      const link = document.createElement("a");
      link.href = url;
      link.target = "_blank";
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setDownloadingFile(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground font-medium">Carregando orçamento...</span>
      </div>
    );
  }

  // Se não existir o orçamento ou se ele estiver inativo
  if (!orcamento || !orcamento.ativo) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
        <Card className="max-w-md w-full border-border/80 shadow-md">
          <CardContent className="p-8 flex flex-col items-center text-center space-y-4">
            <div className="h-12 w-12 rounded-full bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center text-amber-500">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-foreground">Orçamento Indisponível</h2>
              <p className="text-sm text-muted-foreground">
                Este orçamento expirou, foi desativado ou o link é inválido. Por favor, entre em contato com seu representante.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-6">
        
        {/* Cabeçalho */}
        <Card className="border-border shadow-sm overflow-hidden bg-card">
          <div className="h-2 bg-gradient-to-r from-primary to-indigo-600" />
          <CardContent className="p-6 sm:p-8 space-y-4">
            <div className="space-y-4 pb-4 border-b border-border/60">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-primary uppercase tracking-wider block">
                  Gal Representações
                </span>
                <Badge variant="outline" className="bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-300 border-indigo-200/50 dark:border-indigo-900/50 font-bold uppercase tracking-widest text-[10px] px-2 py-0.5 rounded shadow-sm">
                  Orçamento
                </Badge>
              </div>
              
              <div className="space-y-2">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight leading-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  {obra?.nome || orcamento.titulo_versao || "Orçamento de Obra"}
                </h1>
                {obra?.construtora && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium bg-muted/30 px-3 py-1.5 rounded-lg w-fit">
                    <Building2 className="h-4 w-4 text-primary shrink-0" />
                    <span>Construtora: <span className="text-foreground font-semibold">{obra.construtora}</span></span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>Link Seguro de Orçamento</span>
              </span>
              <span>Versão: {orcamento.titulo_versao || "Versão Única"}</span>
            </div>
          </CardContent>
        </Card>

        {/* Blocos de Produtos */}
        <div className="space-y-4">
          {(orcamento.blocos || []).map((bloco, idx) => (
            <Card key={`${bloco.produto}-${idx}`} className="border-border hover:border-primary/20 transition-all shadow-sm">
              <CardHeader className="p-5 pb-3 flex flex-row items-center justify-between gap-4 border-b border-border/40 bg-muted/10">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">
                    Item {idx + 1}
                  </span>
                  <CardTitle className="text-base font-bold text-foreground">
                    {bloco.nome || bloco.produto}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                {bloco.titulo && (
                  <p className="text-sm text-muted-foreground/90 font-medium">
                    {bloco.titulo}
                  </p>
                )}

                {/* Arquivos do Bloco */}
                <div className="space-y-2">
                  {bloco.arquivos && bloco.arquivos.length > 0 ? (
                    bloco.arquivos.map((file, fileIdx) => (
                      <div
                        key={`${file.url}-${fileIdx}`}
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border border-border bg-card hover:bg-muted/10 transition-colors gap-3"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="p-1.5 rounded bg-primary/10 text-primary shrink-0">
                            <FileText className="h-4 w-4" />
                          </div>
                          <span className="text-xs font-semibold text-foreground/80 truncate">
                            {file.nome}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs font-medium flex-1 sm:flex-initial"
                            onClick={() => window.open(file.url, "_blank")}
                          >
                            <Eye className="h-3.5 w-3.5 mr-1" />
                            Ver
                          </Button>
                          <Button
                            variant="default"
                            size="sm"
                            className="h-8 text-xs font-semibold flex-1 sm:flex-initial shadow-sm"
                            disabled={downloadingFile === file.url}
                            onClick={() => handleDownload(file.url, file.nome)}
                          >
                            {downloadingFile === file.url ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Download className="h-3.5 w-3.5 mr-1" />
                            )}
                            Baixar
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-4 text-xs text-muted-foreground italic border border-dashed rounded-lg">
                      Nenhum arquivo anexado a este item.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}

          {(!orcamento.blocos || orcamento.blocos.length === 0) && (
            <div className="text-center py-16 border border-dashed rounded-lg bg-card text-muted-foreground text-sm space-y-1">
              <div>Nenhum item adicionado a este orçamento.</div>
              <div className="text-xs">Entre em contato com seu representante da Gal Representações.</div>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="text-center text-[10px] text-muted-foreground/70 py-4 flex items-center justify-center gap-2">
          <span>&copy; {new Date().getFullYear()} Gal Representações.</span>
          <span>&bull;</span>
          <span>Todos os direitos reservados.</span>
        </div>
      </div>
    </div>
  );
}
