import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Sparkles, Copy, Loader2, AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { listarObras, criarObra, atualizarObra, type Obra } from "@/services/obrasService";
import {
  listarConstrutoras,
  criarConstrutora,
  atualizarConstrutora,
  type Construtora,
} from "@/services/construtorasService";

const PROMPT_TEMPLATE = `Você vai me retornar informações de prospecção em formato JSON ESTRITO seguindo o schema abaixo.

REGRAS:
- Retorne APENAS um objeto JSON válido (sem markdown, sem texto fora do JSON).
- Campos desconhecidos devem ser string vazia "" (nunca null).
- Datas em DD/MM/AAAA.
- Produtos em obras: use APENAS valores em CAIXA ALTA: "PRADO", "RHODEN", "IMAB" (separados por vírgula).
- Produtos em construtoras: use APENAS "Prado", "Rhoden", "Imab" (capitalizado).
- "statusProspeccao" deve ser um de: "Prospectar", "Em prospecção", "Fazendo Orçamento", "Orçamento Enviado", "Fechado", "Perdido".
- "classificacao" deve ser um de: "Baixo", "Médio", "Médio/Alto", "Alto".
- "estagioObra" deve ser um de: "Fundação", "Estrutura", "Alvenaria", "Acabamento", "Finalizado", "Não iniciado".
- "status" de construtora deve ser "Já Cliente" ou "Prospecção".
- Não invente dados. Se não souber, deixe vazio.
- O campo "prospeccaoIA" deve conter um resumo textual organizado de tudo que você pesquisou/inferiu sobre aquela obra ou construtora (insights, contatos extras, links, histórico).

SCHEMA:
{
  "construtoras": [
    {
      "nome": "",
      "cnpj": "",
      "produto": "",
      "status": "Prospecção",
      "observacoes": "",
      "prospeccaoIA": ""
    }
  ],
  "obras": [
    {
      "nome": "",
      "construtora": "",
      "classificacao": "",
      "responsavel": "",
      "telefone": "",
      "email": "",
      "cidade": "",
      "localizacao": "",
      "produtoOferecido": "",
      "estagioObra": "",
      "statusProspeccao": "Prospectar",
      "observacoes": "",
      "concorrentes": "",
      "prospeccaoIA": ""
    }
  ]
}

Agora preencha com os dados solicitados:`;

function norm(s: string) {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

interface ConstrutoraEntry {
  data: Partial<Construtora>;
  existing?: Construtora;
  reuse: boolean; // se true e existing existe, não cria — apenas usa
}
interface ObraEntry {
  data: Partial<Obra>;
  duplicate?: Obra; // obra com mesmo nome+construtora
  construtoraExistente?: Construtora;
  create: boolean; // checkbox para confirmar criação
}

export default function ProspeccaoIA() {
  const { toast } = useToast();
  const [jsonText, setJsonText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [construtoras, setConstrutoras] = useState<ConstrutoraEntry[]>([]);
  const [obras, setObras] = useState<ObraEntry[]>([]);
  const [resumo, setResumo] = useState<string>("");

  function copiarPrompt() {
    navigator.clipboard.writeText(PROMPT_TEMPLATE);
    toast({ title: "Prompt copiado", description: "Cole no ChatGPT e peça as prospecções." });
  }

  async function analisar() {
    setParsing(true);
    setConstrutoras([]);
    setObras([]);
    setResumo("");
    try {
      const cleaned = jsonText.trim().replace(/^```json\s*/i, "").replace(/```$/, "").trim();
      const parsed = JSON.parse(cleaned);
      const ctsIn: Partial<Construtora>[] = Array.isArray(parsed.construtoras) ? parsed.construtoras : [];
      const obrsIn: Partial<Obra>[] = Array.isArray(parsed.obras) ? parsed.obras : [];

      const [todasCts, todasObras] = await Promise.all([listarConstrutoras(), listarObras()]);

      const ctEntries: ConstrutoraEntry[] = ctsIn.map((c) => {
        const target = norm(c.nome || "");
        const existing = todasCts.find((x) => norm(x.nome) === target);
        return { data: c, existing, reuse: !!existing };
      });

      const obrEntries: ObraEntry[] = obrsIn.map((o) => {
        const nomeKey = norm(o.nome || "");
        const ctKey = norm(o.construtora || "");
        const duplicate = todasObras.find(
          (x) => norm(x.nome) === nomeKey && norm(x.construtora) === ctKey,
        );
        const construtoraExistente = todasCts.find((x) => norm(x.nome) === ctKey);
        return { data: o, duplicate, construtoraExistente, create: !duplicate };
      });

      setConstrutoras(ctEntries);
      setObras(obrEntries);

      const novasCt = ctEntries.filter((e) => !e.existing).length;
      const reusedCt = ctEntries.filter((e) => e.existing).length;
      const dupObras = obrEntries.filter((e) => e.duplicate).length;
      setResumo(
        `${ctEntries.length} construtoras (${novasCt} novas, ${reusedCt} já existem) — ` +
        `${obrEntries.length} obras (${dupObras} possíveis duplicatas)`,
      );
    } catch (e) {
      toast({
        title: "JSON inválido",
        description: e instanceof Error ? e.message : "Verifique o formato",
        variant: "destructive",
      });
    } finally {
      setParsing(false);
    }
  }

  async function confirmar() {
    setImporting(true);
    try {
      let ctCriadas = 0;
      let ctAtualizadas = 0;
      // 1) construtoras
      for (const entry of construtoras) {
        const nome = (entry.data.nome || "").trim();
        if (!nome) continue;
        if (entry.existing) {
          // atualiza apenas prospeccaoIA (mescla) se vier preenchido
          const novaIA = (entry.data.prospeccaoIA || "").trim();
          if (novaIA) {
            await atualizarConstrutora(entry.existing.codigo!, {
              prospeccaoIA: novaIA,
            });
            ctAtualizadas++;
          }
        } else {
          await criarConstrutora({
            nome,
            cnpj: entry.data.cnpj || "",
            produto: entry.data.produto || "",
            status: entry.data.status || "Prospecção",
            observacoes: entry.data.observacoes || "",
            prospeccaoIA: entry.data.prospeccaoIA || "",
          });
          ctCriadas++;
        }
      }

      // 2) obras
      let obrCriadas = 0;
      let obrAtualizadas = 0;
      const hoje = new Date().toISOString().split("T")[0];
      for (const entry of obras) {
        if (!entry.create) continue;
        const nome = (entry.data.nome || "").trim();
        if (!nome) continue;
        if (entry.duplicate) {
          // usuário marcou "criar mesmo assim" — atualiza prospeccaoIA na obra existente
          const novaIA = (entry.data.prospeccaoIA || "").trim();
          if (novaIA && entry.duplicate.codigoObra) {
            await atualizarObra(entry.duplicate.codigoObra, {
              ...entry.duplicate,
              prospeccaoIA: novaIA,
            } as Obra);
            obrAtualizadas++;
          }
          continue;
        }
        await criarObra({
          dataCadastro: hoje,
          statusProspeccao: entry.data.statusProspeccao || "Prospectar",
          nome,
          classificacao: entry.data.classificacao || "",
          construtora: entry.data.construtora || "",
          responsavel: entry.data.responsavel || "",
          telefone: entry.data.telefone || "",
          email: entry.data.email || "",
          cidade: entry.data.cidade || "",
          localizacao: entry.data.localizacao || "",
          produtoOferecido: entry.data.produtoOferecido || "",
          estagioObra: entry.data.estagioObra || "",
          marcouReuniao: "",
          visita: "",
          dataUltimaVisita: "",
          dataOrcamentoEnviado: "",
          proximoContato: "",
          linkOrcamentoRhoden: "",
          linkOrcamentoPrado: "",
          linkOrcamentoImab: "",
          observacoes: entry.data.observacoes || "",
          concorrentes: entry.data.concorrentes || "",
          prospeccaoIA: entry.data.prospeccaoIA || "",
        } as Obra);
        obrCriadas++;
      }

      toast({
        title: "Importação concluída",
        description: `${ctCriadas} construtoras criadas, ${ctAtualizadas} atualizadas, ${obrCriadas} obras criadas, ${obrAtualizadas} atualizadas.`,
      });
      setConstrutoras([]);
      setObras([]);
      setJsonText("");
      setResumo("");
    } catch (e) {
      toast({
        title: "Erro na importação",
        description: e instanceof Error ? e.message : "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1
          className="text-2xl font-bold text-foreground flex items-center gap-2"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          <Sparkles className="h-6 w-6 text-primary" />
          Prospecção IA
        </h1>
        <p className="text-muted-foreground mt-1">
          Cole as informações organizadas pelo ChatGPT em JSON. O sistema detecta duplicatas antes de salvar.
        </p>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">1. Copie o prompt e use no ChatGPT</h2>
            <Button variant="outline" size="sm" onClick={copiarPrompt}>
              <Copy className="h-4 w-4 mr-1" /> Copiar prompt
            </Button>
          </div>
          <Textarea readOnly value={PROMPT_TEMPLATE} rows={8} className="font-mono text-xs bg-muted" />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <h2 className="font-semibold">2. Cole aqui o JSON retornado pelo ChatGPT</h2>
          <Textarea
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            rows={10}
            className="font-mono text-xs"
            placeholder='{ "construtoras": [...], "obras": [...] }'
          />
          <div className="flex gap-2">
            <Button onClick={analisar} disabled={!jsonText.trim() || parsing}>
              {parsing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
              Analisar
            </Button>
            {resumo && <div className="flex items-center text-sm text-muted-foreground">{resumo}</div>}
          </div>
        </CardContent>
      </Card>

      {(construtoras.length > 0 || obras.length > 0) && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <h2 className="font-semibold">3. Revise e confirme</h2>

            {construtoras.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2">Construtoras</h3>
                <div className="space-y-2">
                  {construtoras.map((e, i) => (
                    <div key={i} className="border rounded-md p-3 text-sm">
                      <div className="flex items-center gap-2 flex-wrap">
                        {e.existing ? (
                          <Badge variant="secondary">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Já existe — será reaproveitada
                          </Badge>
                        ) : (
                          <Badge variant="default">Nova construtora</Badge>
                        )}
                        <span className="font-medium">{e.data.nome || "(sem nome)"}</span>
                        {e.existing?.codigo && (
                          <span className="text-xs font-mono text-muted-foreground">{e.existing.codigo}</span>
                        )}
                      </div>
                      {e.data.prospeccaoIA && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{e.data.prospeccaoIA}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {obras.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2">Obras</h3>
                <div className="space-y-2">
                  {obras.map((e, i) => (
                    <div key={i} className="border rounded-md p-3 text-sm">
                      <div className="flex items-center gap-2 flex-wrap">
                        {e.duplicate ? (
                          <Badge variant="outline" className="text-amber-700 border-amber-400">
                            <AlertTriangle className="h-3 w-3 mr-1" /> Possível duplicata
                          </Badge>
                        ) : (
                          <Badge variant="default">Nova obra</Badge>
                        )}
                        <span className="font-medium">{e.data.nome || "(sem nome)"}</span>
                        <span className="text-xs text-muted-foreground">
                          • {e.data.construtora || "(sem construtora)"}
                        </span>
                        {e.construtoraExistente && (
                          <Badge variant="secondary" className="text-xs">
                            vincular a {e.construtoraExistente.codigo}
                          </Badge>
                        )}
                      </div>
                      {e.duplicate && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Já existe obra "{e.duplicate.nome}" para esta construtora ({e.duplicate.codigoObra}).
                        </p>
                      )}
                      <label className="flex items-center gap-2 mt-2 cursor-pointer text-xs">
                        <Checkbox
                          checked={e.create}
                          onCheckedChange={(c) => {
                            const next = [...obras];
                            next[i] = { ...next[i], create: !!c };
                            setObras(next);
                          }}
                        />
                        {e.duplicate
                          ? "Atualizar Prospecção IA da obra existente"
                          : "Criar esta obra"}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={confirmar} disabled={importing}>
                {importing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
                Confirmar e importar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
