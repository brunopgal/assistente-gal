import { useEffect, useState, useMemo } from "react";
import { listarObras, type Obra } from "@/services/obrasService";
import { 
  listarApresentacoes, 
  garantirApresentacaoDaObra, 
  marcarEnviado,
  obterResumoAberturasPorVersoes,
  type ApresentacaoPagina,
  type ResumoAberturasVersao 
} from "@/services/orcamentosService";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Search,
  Building2,
  Calendar,
  ExternalLink,
  Copy,
  Presentation
} from "lucide-react";

export default function Apresentacao() {
  const { toast } = useToast();
  const [obras, setObras] = useState<Obra[]>([]);
  const [apresentacoes, setApresentacoes] = useState<Record<string, ApresentacaoPagina>>({});
  const [aberturasMap, setAberturasMap] = useState<Record<string, ResumoAberturasVersao>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [listaObras, listaAps] = await Promise.all([
        listarObras(),
        listarApresentacoes()
      ]);
      setObras(listaObras || []);
      
      const apMap: Record<string, ApresentacaoPagina> = {};
      const apIds: string[] = [];
      (listaAps || []).forEach((ap) => {
        apMap[ap.codigo_obra] = ap;
        apIds.push(ap.id);
      });
      setApresentacoes(apMap);

      if (apIds.length > 0) {
        const aberturas = await obterResumoAberturasPorVersoes(apIds, "apresentacao");
        setAberturasMap(aberturas);
      } else {
        setAberturasMap({});
      }
    } catch (e: any) {
      toast({
        title: "Erro ao carregar dados",
        description: e.message || "Tente novamente mais tarde",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    const initLoad = async () => {
      setLoading(true);
      await fetchData();
      setLoading(false);
    };
    initLoad();
  }, []);

  const filteredObras = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return obras;
    return obras.filter((o) => {
      const matchName = o.nome?.toLowerCase().includes(q);
      const matchConstrutora = o.construtora?.toLowerCase().includes(q);
      const matchCodigo = o.codigoObra?.toLowerCase().includes(q);
      return matchName || matchConstrutora || matchCodigo;
    });
  }, [obras, searchTerm]);

  const handleCopiarLink = async (obra: Obra) => {
    const cod = obra.codigoObra || obra.id;
    if (!cod) return;
    setActionLoading(cod);
    try {
      // Garante que a apresentação existe
      const ap = await garantirApresentacaoDaObra(cod);
      // Marca como enviado
      await marcarEnviado("apresentacao", ap.id);
      
      const link = `https://assistente-gal.lovable.app/apresentacao/${ap.token_apresentacao}`;
      await navigator.clipboard.writeText(link);
      
      toast({
        title: "Link copiado!",
        description: "O link da apresentação foi copiado para a área de transferência.",
      });

      // Recarrega os dados locais para atualizar o timestamp enviado_em e aberturas
      await fetchData();
    } catch (error: any) {
      toast({
        title: "Erro ao processar link",
        description: error.message || "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleAbrirLink = async (obra: Obra) => {
    const cod = obra.codigoObra || obra.id;
    if (!cod) return;
    setActionLoading(cod);
    try {
      const ap = await garantirApresentacaoDaObra(cod);
      const link = `https://assistente-gal.lovable.app/apresentacao/${ap.token_apresentacao}`;
      window.open(link, "_blank");
      
      // Também recarrega para pegar qualquer atualização
      await fetchData();
    } catch (error: any) {
      toast({
        title: "Erro ao abrir link",
        description: error.message || "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
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
      <div>
        <h1
          className="text-2xl font-bold text-foreground"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          Páginas de Apresentação
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gere e envie links seguros de apresentação para cada uma das obras.
        </p>
      </div>

      <div className="flex items-center gap-2 max-w-sm">
        <div className="relative w-full">
          <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            className="pl-9 bg-card/50"
            placeholder="Buscar por obra ou construtora..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredObras.map((o) => {
          const cod = o.codigoObra || o.id!;
          const ap = apresentacoes[cod];
          const aberturas = ap ? aberturasMap[ap.id] : null;
          const totalAberturas = aberturas?.total || 0;
          const isLoadingThis = actionLoading === cod;

          return (
            <Card
              key={cod}
              className="hover:shadow-md transition-all duration-200 border-border bg-card/60 flex flex-col justify-between"
            >
              <CardContent className="p-5 space-y-4 flex-1">
                <div className="space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-foreground line-clamp-1">
                      {o.nome || "Obra Sem Nome"}
                    </h3>
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5 truncate">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    {o.construtora || "Sem construtora vinculada"}
                  </p>
                  <p className="text-[10px] text-muted-foreground font-mono">
                    Código: {cod}
                  </p>
                </div>

                <div className="space-y-3 pt-3 border-t">
                  {ap ? (
                    <div className="space-y-2">
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block">
                          Link Seguro de Apresentação
                        </span>
                        <Input
                          readOnly
                          value={`https://assistente-gal.lovable.app/apresentacao/${ap.token_apresentacao}`}
                          className="h-8 text-xs font-mono bg-background border-indigo-200 select-all"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5 text-[11px] text-muted-foreground pt-1 border-t border-border/30 mt-2">
                        <div>
                          <span className="font-semibold text-foreground/80">Enviado em:</span>{" "}
                          {ap.enviado_em ? (
                            <span className="text-foreground">
                              {new Date(ap.enviado_em).toLocaleString("pt-BR", {
                                timeZone: "America/Sao_Paulo",
                                day: "2-digit",
                                  month: "2-digit",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit"
                              })}
                            </span>
                          ) : (
                            <span className="text-amber-600 font-medium">Não enviado ainda</span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-foreground/80">Status:</span>{" "}
                          {totalAberturas > 0 ? (
                            <Badge
                              variant="outline"
                              className="text-[9px] font-semibold text-emerald-700 dark:text-emerald-400 border-emerald-200/50 bg-emerald-50 dark:bg-emerald-950/20 px-1.5 py-0"
                            >
                              Aberto · {totalAberturas}
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/10 px-1.5 py-0"
                            >
                              Não aberto
                            </Badge>
                          )}
                        </div>

                        {totalAberturas > 0 && aberturas?.ultima && (
                          <div className="text-[10px] text-emerald-600 dark:text-emerald-400">
                            Última abertura:{" "}
                            {new Date(aberturas.ultima).toLocaleString("pt-BR", {
                              timeZone: "America/Sao_Paulo",
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit"
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6 border border-dashed rounded-lg bg-card/25 text-xs text-muted-foreground">
                      Nenhum link gerado. Clique em "Copiar Link" para gerar na hora.
                    </div>
                  )}
                </div>
              </CardContent>

              <div className="p-4 pt-0 border-t bg-muted/5 rounded-b-lg">
                <div className="flex gap-2 mt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs font-semibold"
                    disabled={isLoadingThis}
                    onClick={() => handleAbrirLink(o)}
                  >
                    <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                    Abrir
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    className="flex-1 text-xs font-bold"
                    disabled={isLoadingThis}
                    onClick={() => handleCopiarLink(o)}
                  >
                    {isLoadingThis ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    ) : (
                      <Copy className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    Copiar Link
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}

        {filteredObras.length === 0 && (
          <div className="col-span-full py-16 text-center text-muted-foreground border border-dashed rounded-lg bg-card/25 flex flex-col items-center justify-center gap-2">
            <Presentation className="h-10 w-10 text-muted-foreground/35" />
            <div className="font-semibold text-sm">Nenhuma obra cadastrada</div>
            <div className="text-xs">
              Cadastre obras na aba "Obras" para gerenciar suas apresentações.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
