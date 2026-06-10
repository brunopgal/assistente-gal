import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Copy, Loader2, AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { listarObras, criarObra, atualizarObra, type Obra } from "@/services/obrasService";
import {
  listarConstrutoras,
  criarConstrutora,
  atualizarConstrutora,
  type Construtora,
} from "@/services/construtorasService";
import { listarPessoas, criarPessoa, type Pessoa } from "@/services/pessoasService";

const PROMPT_TEMPLATE = `Você vai me retornar informações de prospecção em formato JSON ESTRITO seguindo exatamente o schema abaixo.

IMPORTANTE:
- Retorne APENAS um JSON válido.
- Não utilize markdown.
- Não escreva explicações.
- Não escreva texto antes ou depois do JSON.
- Nunca utilize null. Campos desconhecidos devem retornar "".
- Datas sempre em DD/MM/AAAA.
- Não invente informações. Se não encontrar um dado, deixe vazio.

==================================================
OBJETIVO
Identificar Construtoras, Obras, Pessoas relacionadas e informações estratégicas para prospecção comercial.

==================================================
REGRAS DE PADRONIZAÇÃO

STATUS COMERCIAL CONSTRUTORA: Prospectar | Em Prospecção | Cliente | Inativa
CLASSIFICAÇÃO DA OBRA: Prédio Residencial | Condomínio de Casas | Outro | Não Informado
PADRÃO DA OBRA: MCMV | Popular | Médio | Alto | Não Informado
ESTÁGIO DA OBRA: Terreno | Fundação | Estrutura | Alvenaria | Acabamento | Finalização | Entregue | Não Informado
ESTÁGIO COMERCIAL: Prospectar | Em Prospecção | Contato Inicial | Visita Realizada | Orçamento Enviado | Negociação | Fechado | Perdido | Não Informado
CARGOS: Compras | Engenheiro | Arquiteto | Mestre de Obras | Dono | Outros | Não Informado
PRODUTOS DA OBRA (CAIXA ALTA, separados por vírgula): PRADO,RHODEN,IMAB
PRODUTOS DA CONSTRUTORA (capitalizado, separados por vírgula): Prado,Rhoden,Imab

==================================================
SCHEMA
{
  "construtoras": [
    {
      "nome": "",
      "cnpj": "",
      "cidade": "",
      "estado": "",
      "statusComercial": "",
      "produtos": "",
      "observacoes": "",
      "prospeccaoIA": ""
    }
  ],
  "pessoas": [
    {
      "nome": "",
      "cargo": "",
      "telefone": "",
      "email": "",
      "construtora": "",
      "obraRelacionada": "",
      "observacoes": ""
    }
  ],
  "obras": [
    {
      "nome": "",
      "construtora": "",
      "classificacao": "",
      "padraoObra": "",
      "cidade": "",
      "estado": "",
      "endereco": "",
      "estagioObra": "",
      "estagioComercial": "",
      "produtos": "",
      "concorrentes": "",
      "proximaAcao": "",
      "observacoes": "",
      "prospeccaoIA": ""
    }
  ]
}

==================================================
REGRAS IMPORTANTES
- Uma construtora pode possuir várias obras e várias pessoas.
- Uma pessoa pode estar relacionada a uma obra específica.
- Se identificar concorrentes (Papaiz, Pado, Yale, Stam, Soprano, etc.), preencher concorrentes.
- O campo "prospeccaoIA" deve conter um resumo estratégico útil para vendas.

Agora preencha com os dados solicitados:`;

function norm(s: string) {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

// ============ Normalizadores (Opção A: prompt novo -> valores canônicos atuais) ============

function mapStatusConstrutora(v: string): string {
  const n = norm(v);
  if (n === "cliente" || n === "ja cliente") return "Já Cliente";
  return "Prospecção"; // Prospectar / Em Prospecção / Inativa / vazio
}

function mapStatusProspeccao(v: string): string {
  const n = norm(v);
  const map: Record<string, string> = {
    "prospectar": "Prospectar",
    "em prospeccao": "Em prospecção",
    "contato inicial": "Em prospecção",
    "visita realizada": "Em prospecção",
    "orcamento enviado": "Orçamento Enviado",
    "negociacao": "Fazendo Orçamento",
    "fazendo orcamento": "Fazendo Orçamento",
    "fechado": "Fechado",
    "perdido": "Perdido",
  };
  return map[n] || "Prospectar";
}

function mapEstagioObra(v: string): string {
  const n = norm(v);
  const map: Record<string, string> = {
    "terreno": "Não iniciado",
    "nao iniciado": "Não iniciado",
    "fundacao": "Fundação",
    "estrutura": "Estrutura",
    "alvenaria": "Alvenaria",
    "acabamento": "Acabamento",
    "finalizacao": "Finalizado",
    "finalizado": "Finalizado",
    "entregue": "Finalizado",
  };
  return map[n] || "";
}

function mapPadraoObra(v: string): string {
  // padraoObra do prompt novo -> classificacao atual (campo único hoje)
  const n = norm(v);
  const map: Record<string, string> = {
    "mcmv": "Baixo",
    "popular": "Baixo",
    "medio": "Médio",
    "alto": "Alto",
  };
  return map[n] || "";
}

function mapProdutosObra(v: string): string {
  // PRADO,RHODEN,IMAB
  return (v || "").toUpperCase().replace(/\s+/g, "");
}

function mapProdutosConstrutora(v: string): string {
  // Prado,Rhoden,Imab
  return (v || "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => p[0].toUpperCase() + p.slice(1).toLowerCase())
    .join(",");
}

function buildObservacoesObra(o: ObraPromptInput): string {
  const extras: string[] = [];
  if (o.observacoes) extras.push(o.observacoes);
  if (o.classificacao) extras.push(`Classificação: ${o.classificacao}`);
  if (o.padraoObra) extras.push(`Padrão: ${o.padraoObra}`);
  if (o.endereco) extras.push(`Endereço: ${o.endereco}`);
  if (o.estado) extras.push(`Estado: ${o.estado}`);
  if (o.proximaAcao) extras.push(`Próxima ação: ${o.proximaAcao}`);
  return extras.join(" | ");
}

function buildObservacoesConstrutora(c: ConstrutoraPromptInput): string {
  const extras: string[] = [];
  if (c.observacoes) extras.push(c.observacoes);
  if (c.cidade) extras.push(`Cidade: ${c.cidade}`);
  if (c.estado) extras.push(`Estado: ${c.estado}`);
  if (c.statusComercial && norm(c.statusComercial) !== "cliente") {
    extras.push(`Status original: ${c.statusComercial}`);
  }
  return extras.join(" | ");
}

// ============ Tipos do prompt novo ============

interface ConstrutoraPromptInput {
  nome?: string;
  cnpj?: string;
  cidade?: string;
  estado?: string;
  statusComercial?: string;
  produtos?: string;
  observacoes?: string;
  prospeccaoIA?: string;
}
interface ObraPromptInput {
  nome?: string;
  construtora?: string;
  classificacao?: string;
  padraoObra?: string;
  cidade?: string;
  estado?: string;
  endereco?: string;
  estagioObra?: string;
  estagioComercial?: string;
  produtos?: string;
  concorrentes?: string;
  proximaAcao?: string;
  observacoes?: string;
  prospeccaoIA?: string;
}
interface PessoaPromptInput {
  nome?: string;
  cargo?: string;
  telefone?: string;
  email?: string;
  construtora?: string;
  obraRelacionada?: string;
  observacoes?: string;
}

interface ConstrutoraEntry {
  raw: ConstrutoraPromptInput;
  data: Partial<Construtora>;
  existing?: Construtora;
  reuse: boolean;
}
interface ObraEntry {
  raw: ObraPromptInput;
  data: Partial<Obra>;
  duplicate?: Obra;
  construtoraExistente?: Construtora;
  create: boolean;
}
interface PessoaEntry {
  raw: PessoaPromptInput;
  data: Partial<Pessoa>;
  duplicate?: Pessoa;
  construtoraExistenteNome?: string;
  obraExistenteNome?: string;
  create: boolean;
}

export default function ProspeccaoIA() {
  const { toast } = useToast();
  const [jsonText, setJsonText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [construtoras, setConstrutoras] = useState<ConstrutoraEntry[]>([]);
  const [obras, setObras] = useState<ObraEntry[]>([]);
  const [pessoas, setPessoas] = useState<PessoaEntry[]>([]);
  const [resumo, setResumo] = useState<string>("");

  function copiarPrompt() {
    navigator.clipboard.writeText(PROMPT_TEMPLATE);
    toast({ title: "Prompt copiado", description: "Cole no ChatGPT e peça as prospecções." });
  }

  async function analisar() {
    setParsing(true);
    setConstrutoras([]);
    setObras([]);
    setPessoas([]);
    setResumo("");
    try {
      const cleaned = jsonText.trim().replace(/^```json\s*/i, "").replace(/```$/, "").trim();
      const parsed = JSON.parse(cleaned);
      const ctsIn: ConstrutoraPromptInput[] = Array.isArray(parsed.construtoras) ? parsed.construtoras : [];
      const obrsIn: ObraPromptInput[] = Array.isArray(parsed.obras) ? parsed.obras : [];
      const pesIn: PessoaPromptInput[] = Array.isArray(parsed.pessoas) ? parsed.pessoas : [];

      const [todasCts, todasObras, todasPessoas] = await Promise.all([
        listarConstrutoras(),
        listarObras(),
        listarPessoas().catch(() => [] as Pessoa[]),
      ]);

      const ctEntries: ConstrutoraEntry[] = ctsIn.map((c) => {
        const target = norm(c.nome || "");
        const existing = todasCts.find((x) => norm(x.nome) === target);
        return {
          raw: c,
          data: {
            nome: c.nome || "",
            cnpj: c.cnpj || "",
            produto: mapProdutosConstrutora(c.produtos || ""),
            status: mapStatusConstrutora(c.statusComercial || ""),
            observacoes: buildObservacoesConstrutora(c),
            prospeccaoIA: c.prospeccaoIA || "",
          },
          existing,
          reuse: !!existing,
        };
      });

      const obrEntries: ObraEntry[] = obrsIn.map((o) => {
        const nomeKey = norm(o.nome || "");
        const ctKey = norm(o.construtora || "");
        const duplicate = todasObras.find(
          (x) => norm(x.nome) === nomeKey && norm(x.construtora) === ctKey,
        );
        const construtoraExistente = todasCts.find((x) => norm(x.nome) === ctKey);
        const classificacaoFinal = mapPadraoObra(o.padraoObra || "");
        return {
          raw: o,
          data: {
            nome: o.nome || "",
            construtora: o.construtora || "",
            classificacao: classificacaoFinal,
            cidade: o.cidade || "",
            produtoOferecido: mapProdutosObra(o.produtos || ""),
            estagioObra: mapEstagioObra(o.estagioObra || ""),
            statusProspeccao: mapStatusProspeccao(o.estagioComercial || ""),
            concorrentes: o.concorrentes || "",
            observacoes: buildObservacoesObra(o),
            prospeccaoIA: o.prospeccaoIA || "",
          },
          duplicate,
          construtoraExistente,
          create: !duplicate,
        };
      });

      const pesEntries: PessoaEntry[] = pesIn.map((p) => {
        const nomeKey = norm(p.nome || "");
        const ctKey = norm(p.construtora || "");
        const obraKey = norm(p.obraRelacionada || "");
        const construtora = todasCts.find((x) => norm(x.nome) === ctKey);
        const obra = todasObras.find(
          (x) => norm(x.nome) === obraKey && (!ctKey || norm(x.construtora) === ctKey),
        );
        const duplicate = todasPessoas.find(
          (x) =>
            norm(x.nome) === nomeKey &&
            (!construtora || x.codigoConstrutora === construtora.codigo),
        );
        return {
          raw: p,
          data: {
            nome: p.nome || "",
            cargo: p.cargo || "Não Informado",
            whatsapp: p.telefone || "",
            email: p.email || "",
            observacoes: p.observacoes || "",
          },
          duplicate,
          construtoraExistenteNome: construtora?.nome,
          obraExistenteNome: obra?.nome,
          create: !duplicate,
        };
      });

      setConstrutoras(ctEntries);
      setObras(obrEntries);
      setPessoas(pesEntries);

      const novasCt = ctEntries.filter((e) => !e.existing).length;
      const reusedCt = ctEntries.filter((e) => e.existing).length;
      const dupObras = obrEntries.filter((e) => e.duplicate).length;
      const dupPes = pesEntries.filter((e) => e.duplicate).length;
      setResumo(
        `${ctEntries.length} construtoras (${novasCt} novas, ${reusedCt} já existem) — ` +
        `${pesEntries.length} pessoas (${dupPes} duplicatas) — ` +
        `${obrEntries.length} obras (${dupObras} duplicatas)`,
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
      // Mapas para resolver código de construtora/obra a partir do nome
      const ctCodigoPorNome = new Map<string, string>();
      const obraCodigoPorChave = new Map<string, string>(); // norm(nome)+'|'+norm(ct)

      let ctCriadas = 0;
      let ctAtualizadas = 0;
      // 1) Construtoras
      for (const entry of construtoras) {
        const nome = (entry.data.nome || "").trim();
        if (!nome) continue;
        if (entry.existing) {
          if (entry.existing.codigo) ctCodigoPorNome.set(norm(nome), entry.existing.codigo);
          const novaIA = (entry.data.prospeccaoIA || "").trim();
          if (novaIA) {
            await atualizarConstrutora(entry.existing.codigo!, { prospeccaoIA: novaIA });
            ctAtualizadas++;
          }
        } else {
          const criada = await criarConstrutora({
            nome,
            cnpj: entry.data.cnpj || "",
            produto: entry.data.produto || "",
            status: entry.data.status || "Prospecção",
            observacoes: entry.data.observacoes || "",
            prospeccaoIA: entry.data.prospeccaoIA || "",
          } as Construtora);
          if (criada?.codigo) ctCodigoPorNome.set(norm(nome), criada.codigo);
          ctCriadas++;
        }
      }

      // 2) Obras
      let obrCriadas = 0;
      let obrAtualizadas = 0;
      const hoje = new Date().toISOString().split("T")[0];
      for (const entry of obras) {
        if (!entry.create) continue;
        const nome = (entry.data.nome || "").trim();
        if (!nome) continue;
        if (entry.duplicate) {
          const novaIA = (entry.data.prospeccaoIA || "").trim();
          if (entry.duplicate.codigoObra) {
            obraCodigoPorChave.set(
              `${norm(nome)}|${norm(entry.duplicate.construtora || "")}`,
              entry.duplicate.codigoObra,
            );
          }
          if (novaIA && entry.duplicate.codigoObra) {
            await atualizarObra(entry.duplicate.codigoObra, {
              ...entry.duplicate,
              prospeccaoIA: novaIA,
            } as Obra);
            obrAtualizadas++;
          }
          continue;
        }
        const ctNome = entry.data.construtora || "";
        const codigoCt = ctCodigoPorNome.get(norm(ctNome)) || "";
        const criada = await criarObra({
          dataCadastro: hoje,
          statusProspeccao: entry.data.statusProspeccao || "Prospectar",
          nome,
          classificacao: entry.data.classificacao || "",
          construtora: ctNome,
          codigoConstrutora: codigoCt,
          responsavel: "",
          telefone: "",
          email: "",
          cidade: entry.data.cidade || "",
          localizacao: "",
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
        if (criada?.codigoObra) {
          obraCodigoPorChave.set(`${norm(nome)}|${norm(ctNome)}`, criada.codigoObra);
        }
        obrCriadas++;
      }

      // 3) Pessoas
      let pesCriadas = 0;
      let pesIgnoradas = 0;
      for (const entry of pessoas) {
        if (!entry.create) {
          pesIgnoradas++;
          continue;
        }
        const nome = (entry.data.nome || "").trim();
        if (!nome) continue;
        const ctNome = entry.raw.construtora || "";
        const codigoCt = ctCodigoPorNome.get(norm(ctNome)) || "";
        if (!codigoCt) {
          // Sem construtora vinculável: pula com aviso
          pesIgnoradas++;
          continue;
        }
        const obraKey = `${norm(entry.raw.obraRelacionada || "")}|${norm(ctNome)}`;
        const codigoObra = obraCodigoPorChave.get(obraKey) || "";
        await criarPessoa({
          codigoConstrutora: codigoCt,
          codigoObraAtual: codigoObra || undefined,
          nome,
          cargo: entry.data.cargo || "Não Informado",
          whatsapp: entry.data.whatsapp || "",
          email: entry.data.email || "",
          observacoes: entry.data.observacoes || "",
        });
        pesCriadas++;
      }

      toast({
        title: "Importação concluída",
        description:
          `${ctCriadas} construtoras criadas, ${ctAtualizadas} atualizadas • ` +
          `${pesCriadas} pessoas criadas${pesIgnoradas ? ` (${pesIgnoradas} ignoradas)` : ""} • ` +
          `${obrCriadas} obras criadas, ${obrAtualizadas} atualizadas.`,
      });
      setConstrutoras([]);
      setObras([]);
      setPessoas([]);
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

  const temResultado = construtoras.length > 0 || obras.length > 0 || pessoas.length > 0;

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
            placeholder='{ "construtoras": [...], "pessoas": [...], "obras": [...] }'
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

      {temResultado && (
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

            {pessoas.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2">Pessoas</h3>
                <div className="space-y-2">
                  {pessoas.map((e, i) => (
                    <div key={i} className="border rounded-md p-3 text-sm">
                      <div className="flex items-center gap-2 flex-wrap">
                        {e.duplicate ? (
                          <Badge variant="outline" className="text-amber-700 border-amber-400">
                            <AlertTriangle className="h-3 w-3 mr-1" /> Já existe
                          </Badge>
                        ) : (
                          <Badge variant="default">Nova pessoa</Badge>
                        )}
                        <span className="font-medium">{e.data.nome || "(sem nome)"}</span>
                        <span className="text-xs text-muted-foreground">• {e.data.cargo}</span>
                        {e.raw.construtora && (
                          <span className="text-xs text-muted-foreground">
                            @ {e.raw.construtora}
                            {e.construtoraExistenteNome ? "" : " (nova)"}
                          </span>
                        )}
                        {e.raw.obraRelacionada && (
                          <span className="text-xs text-muted-foreground">
                            • obra: {e.raw.obraRelacionada}
                          </span>
                        )}
                      </div>
                      {(e.data.whatsapp || e.data.email) && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {e.data.whatsapp} {e.data.email ? `• ${e.data.email}` : ""}
                        </p>
                      )}
                      <label className="flex items-center gap-2 mt-2 cursor-pointer text-xs">
                        <Checkbox
                          checked={e.create}
                          onCheckedChange={(c) => {
                            const next = [...pessoas];
                            next[i] = { ...next[i], create: !!c };
                            setPessoas(next);
                          }}
                        />
                        {e.duplicate ? "Criar mesmo assim (duplicata)" : "Criar esta pessoa"}
                      </label>
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
