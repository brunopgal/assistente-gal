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
  criarAtividadeConstrutora,
  type Construtora,
} from "@/services/construtorasService";
import { listarPessoas, criarPessoa, criarAtividadePessoa, type Pessoa } from "@/services/pessoasService";
import { criarAtividade } from "@/services/atividadesService";
import { norm, strongNorm, onlyDigits } from "@/lib/normalize";

const PROMPT_TEMPLATE = `# PROMPT — Conversor de Obras → JSON do CRM (Painel de Obras) — v2 (com Atividades)

> Cole TUDO isto no ChatGPT/Claude e, no final, cole os dados (planilha, relatório Obras Online, ou suas observações). Agora também gera **atividades** para o histórico.

---

Você é um conversor de dados **determinístico**. Sua função é transformar dados de obras de construção e observações comerciais em JSON para importação no CRM "Painel de Obras".

**Siga as regras EXATAMENTE. Responda APENAS com JSON válido** — sem texto antes ou depois, sem comentários, sem blocos de markdown (nada de \`\`\`). Preserve os acentos (UTF-8). Nunca use null; campo desconhecido = "". Datas em DD/MM/AAAA. Não invente dados.

## ESTRUTURA DA SAÍDA (exatamente estas chaves, nesta ordem)

\`\`\`
{
  "construtoras": [
    { "nome": "", "cnpj": "", "produto": "", "status": "Prospecção", "observacoes": "", "prospeccaoIA": "" }
  ],
  "pessoas": [
    { "nome": "", "cargo": "", "email": "", "telefone": "", "construtora": "", "obraRelacionada": "", "observacoes": "", "prospeccaoIA": "" }
  ],
  "obras": [
    { "nome": "", "construtora": "", "classificacao": "", "padraoObra": "", "cidade": "", "estado": "SP",
      "endereco": "", "estagioObra": "", "estagioComercial": "Prospectar",
      "produtos": "", "concorrentes": "", "proximaAcao": "", "observacoes": "", "prospeccaoIA": "" }
  ],
  "atividades": [
    { "origem": "construtora", "construtora": "", "obra": "", "contato": "",
      "data": "", "tipoContato": "Observação", "status": "", "comentario": "", "proximoContato": "" }
  ]
}
\`\`\`

## VALORES PERMITIDOS (use EXATAMENTE estes textos)

### \`obras.classificacao\` — é o PADRÃO da obra (dropdown, só 1 destes 4, ou vazio)
- **"Baixo Padrão"** ← Baixo, Popular, Econômico, MCMV, "Minha Casa Minha Vida", Standard
- **"Médio Padrão"** ← Médio
- **"Médio/Alto Padrão"** ← Médio/Alto, Médio-Alto
- **"Alto Padrão"** ← Alto, Alto Luxo, Luxo, Altíssimo, Super Luxo
- Sem informação de padrão: **""**. **NUNCA invente.**
- ⚠️ **NUNCA** coloque o tipo de imóvel aqui (Prédio/Condomínio). Tipo vai em \`observacoes\`.

### \`obras.padraoObra\` — eco curto: "Baixo" | "Médio" | "Médio/Alto" | "Alto" | ""

### \`obras.estagioObra\` — dropdown
- **"Não Iniciado"** ← terreno, lançamento, pré-obra, não iniciado
- **"Inicial"** ← fundação, estrutura, "Execução / Inicial", início
- **"Médio"** ← alvenaria, intermediária, em andamento
- **"Final"** ← acabamento, "Execução / Final", fase final
- **"Finalizado"** ← entregue, concluída, finalizada
- Desconhecido: **"Inicial"**.

### \`obras.estagioComercial\` — para prospecção, use SEMPRE **"Prospectar"**.
### \`obras.produtos\` — **""** (a definir). Quando souber: "IMAB" | "RHODEN" | "PRADO" | "Nenhum".
### \`obras.estado\` — UF 2 letras (default **"SP"**).
### \`obras.observacoes\` — TIPO do imóvel + origem. Ex.: \`"Tipo: Prédio Residencial. Origem: Obras Online. Status: Obra em Construção."\`

### \`pessoas.cargo\` — dropdown
- **"Compras"** ← Comprador, Compras, Suprimentos, Coordenador/Gerente/Analista de Compras/Suprimentos
- **"Engenheiro"** ← Engenheiro, Gerente/Coordenador/Diretor de Obras/Engenharia/Projetos, Orçamentista, RT, Assistente de Engenharia
- **"Arquiteto"** ← Arquiteto
- **"Mestre de Obras"** ← Mestre de Obras
- **"Dono"** ← Sócio, Proprietário, Sócio Proprietário
- **"Outros"** ← Diretor (genérico), Administrador, Gerente (genérico), Marketing, Financeiro, Recepção
- **"Não Informado"** ← sem cargo
### \`pessoas.telefone\` — como veio. \`pessoas.email\` — minúsculas.

### \`construtoras\`
- \`nome\`: razão social. \`cnpj\`: "" se não houver. \`produto\`: "". \`status\`: "Prospecção". \`prospeccaoIA\`: resumo curto (1 linha).

### \`atividades\` — registros para o histórico (observações, contatos, decisões de produto, etc.)
- **\`origem\`** — de quem é a atividade: **"construtora" | "obra" | "pessoa"**. É a entidade "dona" do registro.
- **\`construtora\` / \`obra\` / \`contato\`** — NOMES. O da origem é obrigatório; os outros dois são **vínculos opcionais** (só preencha se a observação se referir a eles).
  - origem "construtora" → \`construtora\` obrigatório; \`obra\`/\`contato\` opcionais.
  - origem "obra" → \`obra\` obrigatório; \`construtora\`/\`contato\` opcionais.
  - origem "pessoa" → \`contato\` obrigatório; \`construtora\`/\`obra\` opcionais.
- **\`comentario\`** — o texto da observação em si. Ex.: \`"Posso atender esta obra com PRADO. Avaliar se RHODEN se aplica no acabamento."\`
- **\`tipoContato\`** — "Observação" para notas estratégicas; ou "WhatsApp" | "Ligação" | "Visita" | "E-mail" | "Reunião" quando for um contato real.
- **\`data\`** — DD/MM/AAAA; vazio = hoje. **\`status\`** e **\`proximoContato\`** — "" salvo se informado.
- **Uma observação = uma atividade.** Não agrupe várias observações num comentário só.
- Todo nome citado em \`construtora\`/\`obra\`/\`contato\` deve existir nas arrays acima OU já existir no CRM (será resolvido por nome). **Não invente entidade.**

## REGRAS DE NEGÓCIO
1. **Construtora da obra** = empresa com papel **"Construtor"**; senão **"Incorporadora"**; senão a primeira. **NUNCA** use Escritório de Arquitetura/Engenharia/Projetos externo como construtora.
2. **Contatos**: inclua todas as pessoas COM NOME. **PULE** escritório de arquitetura externo e linhas sem nome. Vincule cada contato à construtora principal e à \`obraRelacionada\`.
3. **Tipo do imóvel** → \`obras.observacoes\`. **Nunca** em \`classificacao\`.
4. **Deduplicação**: construtoras por CNPJ (senão nome normalizado) → 1 registro. Pessoas por email (senão nome+construtora) → 1 registro. (Atividades **não** são deduplicadas — cada uma é um registro do histórico.)
5. **Integridade**: toda \`obra.construtora\`, \`pessoa.construtora\`, \`pessoa.obraRelacionada\` e cada vínculo de \`atividades\` deve existir nas arrays ou no CRM. **Sem órfãos inventados.**
6. **Não invente dados.** Campo desconhecido = "".
7. Se houver **mais de 40 obras**, divida em blocos de ~35–40 (um bloco por resposta), cada um completo e íntegro.

## EXEMPLO (referência de formato)
\`\`\`
{
  "construtoras": [
    { "nome": "Construtora Exemplo Ltda", "cnpj": "", "produto": "", "status": "Prospecção", "observacoes": "", "prospeccaoIA": "Construtora mapeada. 1 obra(s)." }
  ],
  "pessoas": [
    { "nome": "Maria Compras", "cargo": "Compras", "email": "compras@exemplo.com.br", "telefone": "(11) 1234-5678", "construtora": "Construtora Exemplo Ltda", "obraRelacionada": "Residencial Exemplo", "observacoes": "", "prospeccaoIA": "" }
  ],
  "obras": [
    { "nome": "Residencial Exemplo", "construtora": "Construtora Exemplo Ltda", "classificacao": "Médio Padrão", "padraoObra": "Médio",
      "cidade": "Campinas", "estado": "SP", "endereco": "Rua Exemplo, 100 - Centro - 13000-000",
      "estagioObra": "Final", "estagioComercial": "Prospectar", "produtos": "", "concorrentes": "", "proximaAcao": "",
      "observacoes": "Tipo: Prédio Residencial. Origem: Obras Online. Status: Obra em Construção.",
      "prospeccaoIA": "Obra Médio Padrão (Prédio Residencial) em Campinas, em construção. Priorizar Compras/Engenharia." }
  ],
  "atividades": [
    { "origem": "construtora", "construtora": "Construtora Exemplo Ltda", "obra": "Residencial Exemplo", "contato": "Maria Compras",
      "data": "", "tipoContato": "Observação", "status": "",
      "comentario": "Posso atender com PRADO. Avaliar RHODEN para o acabamento. Confirmar com Compras.", "proximoContato": "" }
  ]
}
\`\`\`

## DADOS PARA CONVERTER
Gere o JSON seguindo TODAS as regras acima a partir dos dados abaixo:

[COLE AQUI OS DADOS DAS OBRAS / SUAS OBSERVAÇÕES]`;

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
    "em prospeccao": "Em Prospecção",
    "contato inicial": "Em Prospecção",
    "visita realizada": "Lead Quente",
    "lead quente": "Lead Quente",
    "fazendo orcamento": "Fazendo Orçamento",
    "orcamento enviado": "Orçamento Enviado",
    "negociacao": "Negociação",
    "fechado": "Fechado",
    "perdido": "Perdido",
  };
  return map[n] || "Prospectar";
}

function mapEstagioObra(v: string): string {
  const n = norm(v);
  const map: Record<string, string> = {
    "terreno": "Não Iniciado",
    "nao iniciado": "Não Iniciado",
    "inicial": "Inicial",
    "fundacao": "Inicial",
    "estrutura": "Inicial",
    "medio": "Médio",
    "alvenaria": "Médio",
    "final": "Final",
    "acabamento": "Final",
    "execucao final": "Final",
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
    "mcmv": "Baixo Padrão",
    "popular": "Baixo Padrão",
    "baixo": "Baixo Padrão",
    "baixo padrao": "Baixo Padrão",
    "medio": "Médio Padrão",
    "medio padrao": "Médio Padrão",
    "medio/alto": "Médio/Alto Padrão",
    "medio/alto padrao": "Médio/Alto Padrão",
    "alto": "Alto Padrão",
    "alto padrao": "Alto Padrão",
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
  if (o.proximaAcao) extras.push(`Próxima ação: ${o.proximaAcao}`);
  if (o.estado) extras.push(`Estado: ${o.estado}`);
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
  codigoConstrutoraOverride?: string;
  create: boolean;
}

interface AtividadePromptInput {
  origem: "construtora" | "obra" | "pessoa";
  construtora?: string;   // nome
  obra?: string;          // nome
  contato?: string;       // nome
  data?: string;          // DD/MM/AAAA
  tipoContato?: string;
  status?: string;
  comentario?: string;
  proximoContato?: string;
}
interface AtividadeEntry {
  raw: AtividadePromptInput;
  origem: "construtora" | "obra" | "pessoa";
  donoNome: string;        // nome da entidade dona (para exibir)
  obraNome?: string;       // vínculo
  construtoraNome?: string;// vínculo
  contatoNome?: string;    // vínculo
  comentario: string;
  data: string;
  tipoContato?: string;
  status?: string;
  proximoContato?: string;
  resolvivel: boolean;     // se a entidade dona é resolvível (batch ou CRM)
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
  const [atividades, setAtividades] = useState<AtividadeEntry[]>([]);
  const [todasCtsList, setTodasCtsList] = useState<Construtora[]>([]);
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
    setAtividades([]);
    setResumo("");
    try {
      const cleaned = jsonText.trim().replace(/^```json\s*/i, "").replace(/```$/, "").trim();
      const parsed = JSON.parse(cleaned);
      const ctsIn: ConstrutoraPromptInput[] = Array.isArray(parsed.construtoras) ? parsed.construtoras : [];
      const obrsIn: ObraPromptInput[] = Array.isArray(parsed.obras) ? parsed.obras : [];
      const pesIn: PessoaPromptInput[] = Array.isArray(parsed.pessoas) ? parsed.pessoas : [];
      const ativsIn: AtividadePromptInput[] = Array.isArray(parsed.atividades) ? parsed.atividades : [];

      const [todasCts, todasObras, todasPessoas] = await Promise.all([
        listarConstrutoras(),
        listarObras(),
        listarPessoas().catch(() => [] as Pessoa[]),
      ]);

      const ctEntries: ConstrutoraEntry[] = ctsIn.map((c) => {
        const pNomeNorm = strongNorm(c.nome || "");
        const pCnpjDigits = onlyDigits(c.cnpj || "");

        const existing = todasCts.find((x) => {
          const xCnpjDigits = onlyDigits(x.cnpj || "");
          if (pCnpjDigits && xCnpjDigits && pCnpjDigits === xCnpjDigits) {
            return true;
          }
          const xNomeNorm = strongNorm(x.nome || "");
          if (pNomeNorm && xNomeNorm && pNomeNorm === xNomeNorm) {
            return true;
          }
          return false;
        });

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
        const nomeKey = strongNorm(o.nome || "");
        const ctKey = strongNorm(o.construtora || "");
        const duplicate = todasObras.find(
          (x) => strongNorm(x.nome) === nomeKey && strongNorm(x.construtora) === ctKey,
        );
        const construtoraExistente = todasCts.find((x) => strongNorm(x.nome) === ctKey);
        const valClassificacao = mapPadraoObra(o.classificacao || "");
        const valPadrao = mapPadraoObra(o.padraoObra || "");
        const classificacaoFinal = valClassificacao || valPadrao || "";

        // Encontra pessoa relacionada para preencher dados de contato
        const matchingPeople = pesIn.filter((p) => {
          const sameObra = strongNorm(p.obraRelacionada || "") === nomeKey;
          const sameConstrutora = !p.construtora || !o.construtora || strongNorm(p.construtora) === ctKey;
          return sameObra && sameConstrutora;
        });
        const bestPerson = matchingPeople.find((p) => {
          const c = norm(p.cargo || "");
          return c.includes("compras") || c.includes("comprador");
        }) || matchingPeople[0];

        return {
          raw: o,
          data: {
            nome: o.nome || "",
            construtora: o.construtora || "",
            classificacao: classificacaoFinal,
            cidade: o.cidade || "",
            localizacao: o.endereco || "",
            produtoOferecido: mapProdutosObra(o.produtos || ""),
            estagioObra: mapEstagioObra(o.estagioObra || ""),
            statusProspeccao: mapStatusProspeccao(o.estagioComercial || ""),
            concorrentes: o.concorrentes || "",
            observacoes: buildObservacoesObra(o),
            prospeccaoIA: o.prospeccaoIA || "",
            responsavel: bestPerson?.nome || "",
            telefone: bestPerson?.telefone || "",
            email: bestPerson?.email || "",
          },
          duplicate,
          construtoraExistente,
          create: !duplicate,
        };
      });

      const pesEntries: PessoaEntry[] = pesIn.map((p) => {
        const pEmailNorm = (p.email || "").toLowerCase().replace(/\s+/g, "");
        const pNomeNorm = strongNorm(p.nome || "");
        const pTelDigits = onlyDigits(p.telefone || "");
        const pCtNorm = strongNorm(p.construtora || "");

        const construtora = todasCts.find((x) => strongNorm(x.nome) === pCtNorm);
        const obra = todasObras.find(
          (x) => strongNorm(x.nome) === strongNorm(p.obraRelacionada || "") && 
                 (!p.construtora || strongNorm(x.construtora) === pCtNorm),
        );

        const duplicate = todasPessoas.find((x) => {
          // 1) Email check
          const xEmailNorm = (x.email || "").toLowerCase().replace(/\s+/g, "");
          if (pEmailNorm && xEmailNorm && pEmailNorm === xEmailNorm) {
            return true;
          }

          // 2) Nome matches AND (telefone matches OR construtora matches)
          const xNomeNorm = strongNorm(x.nome || "");
          if (pNomeNorm && xNomeNorm && pNomeNorm === xNomeNorm) {
            const xTelDigits = onlyDigits(x.whatsapp || "");
            const telMatches = pTelDigits && xTelDigits && pTelDigits === xTelDigits;

            const xCt = todasCts.find((c) => c.codigo === x.codigoConstrutora);
            const xCtNorm = xCt ? strongNorm(xCt.nome) : "";
            const ctMatches = pCtNorm && xCtNorm && pCtNorm === xCtNorm;

            if (telMatches || ctMatches) {
              return true;
            }
          }

          return false;
        });

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

      const ativEntries: AtividadeEntry[] = ativsIn.map((raw) => {
        const origem = raw.origem || "construtora";
        
        let donoNome = "";
        if (origem === "construtora") donoNome = raw.construtora || "";
        else if (origem === "obra") donoNome = raw.obra || "";
        else if (origem === "pessoa") donoNome = raw.contato || "";

        const donoNorm = strongNorm(donoNome);
        let resolvivel = false;

        if (origem === "construtora") {
          const inBatch = ctsIn.some((x) => strongNorm(x.nome || "") === donoNorm);
          const inCRM = todasCts.some((x) => strongNorm(x.nome || "") === donoNorm);
          resolvivel = inBatch || inCRM;
        } else if (origem === "obra") {
          const inBatch = obrsIn.some((x) => strongNorm(x.nome || "") === donoNorm);
          const inCRM = todasObras.some((x) => strongNorm(x.nome || "") === donoNorm);
          resolvivel = inBatch || inCRM;
        } else if (origem === "pessoa") {
          const inBatch = pesIn.some((x) => strongNorm(x.nome || "") === donoNorm);
          const inCRM = todasPessoas.some((x) => strongNorm(x.nome || "") === donoNorm);
          resolvivel = inBatch || inCRM;
        }

        return {
          raw,
          origem,
          donoNome,
          obraNome: raw.obra,
          construtoraNome: raw.construtora,
          contatoNome: raw.contato,
          comentario: raw.comentario || "",
          data: raw.data || "",
          tipoContato: raw.tipoContato || "",
          status: raw.status || "",
          proximoContato: raw.proximoContato || "",
          resolvivel,
          create: resolvivel,
        };
      });

      setConstrutoras(ctEntries);
      setObras(obrEntries);
      setPessoas(pesEntries);
      setAtividades(ativEntries);
      setTodasCtsList(todasCts);

      const novasCt = ctEntries.filter((e) => !e.existing).length;
      const reusedCt = ctEntries.filter((e) => e.existing).length;
      const dupObras = obrEntries.filter((e) => e.duplicate).length;
      const dupPes = pesEntries.filter((e) => e.duplicate).length;
      setResumo(
        `${ctEntries.length} construtoras (${novasCt} novas, ${reusedCt} já existem) — ` +
        `${pesEntries.length} pessoas (${dupPes} duplicatas) — ` +
        `${obrEntries.length} obras (${dupObras} duplicatas) — ` +
        `${ativEntries.length} atividades`,
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
      const [todasObras, todasPessoas] = await Promise.all([
        listarObras(),
        listarPessoas().catch(() => [] as Pessoa[]),
      ]);

      // Mapas para resolver código de construtora/obra a partir do nome
      const ctCodigoPorNome = new Map<string, string>();
      const obraCodigoPorChave = new Map<string, string>(); // strongNorm(nome)+'|'+strongNorm(ct)

      let ctCriadas = 0;
      let ctAtualizadas = 0;
      // 1) Construtoras
      for (const entry of construtoras) {
        const nome = (entry.data.nome || "").trim();
        if (!nome) continue;
        if (entry.existing) {
          if (entry.existing.codigo) ctCodigoPorNome.set(strongNorm(nome), entry.existing.codigo);
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
          if (criada?.codigo) ctCodigoPorNome.set(strongNorm(nome), criada.codigo);
          ctCriadas++;
        }
      }

      for (const c of todasCtsList) {
        const key = strongNorm(c.nome || "");
        if (key && c.codigo && !ctCodigoPorNome.has(key)) {
          ctCodigoPorNome.set(key, c.codigo);
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
              `${strongNorm(nome)}|${strongNorm(entry.duplicate.construtora || "")}`,
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
        const codigoCt = ctCodigoPorNome.get(strongNorm(ctNome)) || "";
        const criada = await criarObra({
          dataCadastro: hoje,
          statusProspeccao: entry.data.statusProspeccao || "Prospectar",
          nome,
          classificacao: entry.data.classificacao || "",
          construtora: ctNome,
          codigoConstrutora: codigoCt,
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
        if (criada?.codigoObra) {
          obraCodigoPorChave.set(`${strongNorm(nome)}|${strongNorm(ctNome)}`, criada.codigoObra);
        }
        obrCriadas++;
      }

      const obraCodigoPorNome = new Map<string, string>();
      for (const o of todasObras) {
        const key = `${strongNorm(o.nome || "")}|${strongNorm(o.construtora || "")}`;
        if (o.codigoObra) {
          if (!obraCodigoPorChave.has(key)) {
            obraCodigoPorChave.set(key, o.codigoObra);
          }
          const nameKey = strongNorm(o.nome || "");
          if (nameKey && !obraCodigoPorNome.has(nameKey)) {
            obraCodigoPorNome.set(nameKey, o.codigoObra);
          }
        }
      }

      // 3) Pessoas
      const pessoaCodigoPorNome = new Map<string, string>();
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
        let codigoCt = ctCodigoPorNome.get(strongNorm(ctNome)) || "";
        if (!codigoCt && entry.codigoConstrutoraOverride) {
          codigoCt = entry.codigoConstrutoraOverride;
        }
        if (!codigoCt) {
          // Sem construtora vinculável: pula com aviso
          pesIgnoradas++;
          continue;
        }
        const obraKey = `${strongNorm(entry.raw.obraRelacionada || "")}|${strongNorm(ctNome)}`;
        const codigoObra = obraCodigoPorChave.get(obraKey) || "";
        const criada = await criarPessoa({
          codigoConstrutora: codigoCt,
          codigoObraAtual: codigoObra || undefined,
          nome,
          cargo: entry.data.cargo || "Não Informado",
          whatsapp: entry.data.whatsapp || "",
          email: entry.data.email || "",
          observacoes: entry.data.observacoes || "",
        });
        if (criada?.codigoPessoa) {
          pessoaCodigoPorNome.set(strongNorm(nome), criada.codigoPessoa);
        }
        pesCriadas++;
      }

      for (const p of todasPessoas) {
        const key = strongNorm(p.nome || "");
        if (key && p.codigoPessoa && !pessoaCodigoPorNome.has(key)) {
          pessoaCodigoPorNome.set(key, p.codigoPessoa);
        }
      }

      // 4) Atividades
      let ativCriadas = 0;
      let ativIgnoradas = 0;
      const d = new Date();
      const dia = String(d.getDate()).padStart(2, '0');
      const mes = String(d.getMonth() + 1).padStart(2, '0');
      const ano = d.getFullYear();
      const hojeBR = `${dia}/${mes}/${ano}`;

      for (const entry of atividades) {
        if (!entry.create) {
          ativIgnoradas++;
          continue;
        }

        const construtoraNorm = strongNorm(entry.construtoraNome || "");
        const obraNorm = strongNorm(entry.obraNome || "");
        const contatoNorm = strongNorm(entry.contatoNome || "");

        const codConstrutora = construtoraNorm ? (ctCodigoPorNome.get(construtoraNorm) || "") : "";
        const chaveObra = `${obraNorm}|${construtoraNorm}`;
        const codObra = obraNorm ? (obraCodigoPorChave.get(chaveObra) || obraCodigoPorNome.get(obraNorm) || "") : "";
        const codPessoa = contatoNorm ? (pessoaCodigoPorNome.get(contatoNorm) || "") : "";

        // Validar dono resolvido
        let codDono = "";
        if (entry.origem === "construtora") codDono = codConstrutora;
        else if (entry.origem === "obra") codDono = codObra;
        else if (entry.origem === "pessoa") codDono = codPessoa;

        if (!codDono) {
          ativIgnoradas++;
          continue;
        }

        const dataAtiv = entry.raw.data?.trim() || hojeBR;
        const tipoContato = entry.raw.tipoContato || "Outro";
        const status = entry.raw.status || "";
        const comentario = entry.raw.comentario || "";
        const proximoContato = entry.raw.proximoContato || "";

        if (entry.origem === "obra") {
          await criarAtividade({
            idObra: codObra,
            dataAtividade: dataAtiv,
            tipoContato,
            status,
            comentario,
            proximoContato,
            codigoConstrutora: codConstrutora || undefined,
            codigoPessoa: codPessoa || undefined,
          });
        } else if (entry.origem === "construtora") {
          await criarAtividadeConstrutora({
            codigoConstrutora: codConstrutora,
            tipoRegistro: "atividade",
            data: dataAtiv,
            tipoContato,
            status,
            comentario,
            proximoContato,
            idObra: codObra || undefined,
            codigoPessoa: codPessoa || undefined,
          });
        } else if (entry.origem === "pessoa") {
          await criarAtividadePessoa({
            codigoPessoa: codPessoa,
            tipoRegistro: "atividade",
            data: dataAtiv,
            tipoContato,
            status,
            comentario,
            proximoContato,
            idObra: codObra || undefined,
            codigoConstrutora: codConstrutora || undefined,
          });
        }

        ativCriadas++;
      }

      toast({
        title: "Importação concluída",
        description:
          `${ctCriadas} construtoras criadas, ${ctAtualizadas} atualizadas • ` +
          `${pesCriadas} pessoas criadas${pesIgnoradas ? ` (${pesIgnoradas} ignoradas)` : ""} • ` +
          `${obrCriadas} obras criadas, ${obrAtualizadas} atualizadas • ` +
          `${ativCriadas} atividades criadas${ativIgnoradas ? ` (${ativIgnoradas} ignoradas)` : ""}.`,
      });
      setConstrutoras([]);
      setObras([]);
      setPessoas([]);
      setAtividades([]);
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

  const temResultado = construtoras.length > 0 || obras.length > 0 || pessoas.length > 0 || atividades.length > 0;

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
                      {!e.raw.construtora && !e.codigoConstrutoraOverride && (
                        <div className="mt-2 flex items-center gap-2 text-xs">
                          <AlertTriangle className="h-3 w-3 text-amber-500" />
                          <span className="text-amber-600">Sem construtora — selecione uma para importar:</span>
                        </div>
                      )}
                      {!e.raw.construtora && (
                        <div className="mt-1">
                          <Select
                            value={e.codigoConstrutoraOverride || ""}
                            onValueChange={(v) => {
                              const next = [...pessoas];
                              next[i] = { ...next[i], codigoConstrutoraOverride: v };
                              setPessoas(next);
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Vincular a uma construtora existente..." />
                            </SelectTrigger>
                            <SelectContent>
                              {todasCtsList.map((c) => (
                                <SelectItem key={c.codigo} value={c.codigo!}>
                                  {c.nome} {c.codigo ? `(${c.codigo})` : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
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

            {atividades.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2">Atividades</h3>
                <div className="space-y-2">
                  {atividades.map((e, i) => (
                    <div key={i} className="border rounded-md p-3 text-sm">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="capitalize">
                          {e.origem === "pessoa" ? "contato" : e.origem}
                        </Badge>
                        <span className="font-medium">{e.donoNome || "(sem nome)"}</span>
                        {e.data ? (
                          <span className="text-xs text-muted-foreground">
                            • Data: {e.data}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            • Data: hoje
                          </span>
                        )}
                        {e.tipoContato && (
                          <span className="text-xs text-muted-foreground">
                            • Tipo: {e.tipoContato}
                          </span>
                        )}
                        {e.status && (
                          <span className="text-xs text-muted-foreground">
                            • Status: {e.status}
                          </span>
                        )}
                      </div>

                      {/* Vínculos */}
                      {(e.obraNome || e.construtoraNome || e.contatoNome) && (
                        <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-2 gap-y-1">
                          {e.obraNome && <span>Obra: {e.obraNome}</span>}
                          {e.construtoraNome && <span>Construtora: {e.construtoraNome}</span>}
                          {e.contatoNome && <span>Contato: {e.contatoNome}</span>}
                        </div>
                      )}

                      {e.comentario && (
                        <p className="text-xs text-muted-foreground mt-1 bg-muted p-1.5 rounded font-mono">
                          {e.comentario}
                        </p>
                      )}

                      {e.resolvivel === false && (
                        <div className="mt-2 flex items-center gap-2 text-xs text-amber-600">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                          <span>Entidade não encontrada — será ignorada se não marcada</span>
                        </div>
                      )}

                      <label className="flex items-center gap-2 mt-2 cursor-pointer text-xs">
                        <Checkbox
                          checked={e.create}
                          onCheckedChange={(c) => {
                            const next = [...atividades];
                            next[i] = { ...next[i], create: !!c };
                            setAtividades(next);
                          }}
                        />
                        Criar esta atividade
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
