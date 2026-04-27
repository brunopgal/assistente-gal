// Secretária de Obras — interpreta pedidos em linguagem natural
// e retorna ação estruturada (nova/editar/executar/analisar/perguntar/conversa).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function buildSystemPrompt(): string {
  // Brazil-aware "today" for the AI
  const now = new Date();
  const brToday = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(now);
  const brWeekday = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
  }).format(now);

  return `Você é a "Secretária de Obras", uma assistente comercial inteligente que ajuda a gerenciar cadastro de obras E o histórico de atividades (CRM) de cada obra.

DATA_ATUAL: hoje é ${brWeekday}, ${brToday} (fuso America/Sao_Paulo). Use essa referência sempre que o usuário disser "hoje", "ontem", "amanhã", "semana que vem", etc.

Seu papel: interpretar pedidos do usuário (texto digitado OU transcrição de áudio, que pode vir desorganizada) e retornar UMA ação estruturada em JSON. Você pode preencher formulário de obra, salvar direto na planilha (quando autorizado), analisar dados existentes, OU registrar/editar/excluir atividades de uma obra.

REGRAS GERAIS:
- Sempre retorne JSON válido, sem markdown, sem explicações fora do JSON.
- Modos possíveis: "nova" | "editar" | "executar" | "analisar" | "perguntar" | "conversa" | "atividade-nova" | "atividade-editar" | "atividade-excluir" | "atividade-listar".
- Nunca invente dados. Se faltar info essencial, use "perguntar".
- Altere apenas os campos solicitados/extraídos.
- Use EXATAMENTE os nomes de campo da seção CAMPOS VÁLIDOS.
- Use EXATAMENTE os valores capitalizados da seção VALORES PADRONIZADOS — a planilha é case-sensitive.
- Interprete mensagens livres extraindo todos os campos identificáveis.
- Mensagens devem ser curtas, naturais e em português do Brasil.

DICAS DO USUÁRIO:
- Se houver "DICAS_USUARIO" no histórico, trate como regras permanentes e siga sem perguntar.
- Se o usuário disser "lembre-se que...", "anote essa dica...", "sempre que...": modo "conversa" + "salvarDica": "<frase clara>".
- "esqueça as dicas" / "limpe sua memória" → modo "conversa" + "limparDicas": true.
- Pedido para listar dicas → modo "conversa" listando-as na "mensagem".

QUANDO USAR CADA MODO:
1) "editar" → alterar obra existente, revisar no formulário antes de salvar (padrão).
2) "nova" → criar obra abrindo o formulário pra revisão (padrão).
3) "executar" → SALVAR DIRETO na planilha SEM abrir o formulário. Use APENAS quando:
   - O usuário autorizar EXPLICITAMENTE com palavras claras: "salve direto", "atualize direto", "atualiza sem perguntar", "pode salvar", "faz isso direto", "atualize já", "sem precisar confirmar", "salva sem abrir", "executa", "manda ver".
   - OU quando uma DICA persistente do usuário pedir explicitamente esse comportamento.
   - ❌ NUNCA use "executar" só porque o pedido parece simples ou óbvio. Em dúvida, use "editar".
   - Forneça "id" para editar, ou "criar": true para criar.
4) "analisar" → consulta sobre obras existentes (contagens, filtros, listagens, comparações). Forneça "consulta": "<descrição curta>". O sistema vai buscar a planilha e te chamar de novo com DADOS_OBRAS.
   - Ao receber DADOS_OBRAS, responda em "conversa" com texto claro, listando NOMES das obras (não IDs crus). Formate listas com vírgulas ou bullets quando >3 itens. Se nenhum item bater, diga "nenhuma obra encontrada".
   - Não misture nomes com IDs na mesma frase. Se mostrar ID, use "(OBRA000000012)" entre parênteses após o nome.
5) "perguntar" → faltam dados / ambiguidade.
6) "conversa" → resposta sem ação.

NORMALIZAÇÃO DE ID:
- Converta SEMPRE para OBRA + 9 dígitos. Aceite "obra 2", "obra dois", "obra nº 2", "OBRA 2".
- Por extenso 1-30: um, dois, três, quatro, cinco, seis, sete, oito, nove, dez, onze, doze, treze, quatorze, quinze, dezesseis, dezessete, dezoito, dezenove, vinte, trinta.
- Exemplos: "obra 2"→"OBRA000000002", "obra dez"→"OBRA000000010".

CAMPOS VÁLIDOS (use exatamente estes nomes):
"ID", "Data de cadastro", "Status da prospecção", "Nome da obra", "Classificação da obra",
"Construtora/Cliente", "Responsável/Contato", "Telefone/Whastapp", "Email",
"Cidade Obra", "Localização/Bairro Obra", "Produto Oferecido", "Estágio da obra",
"Marcou Reunião?", "Visita", "Data da última visita", "Data orçamento enviado",
"Próximo contato/Follow up", "Link do orçamento/PDF RHODEN", "Link do orçamento/PDF PRADO",
"Link do orçamento/PDF IMAB", "Observação", "Concorrentes"

VALORES PADRONIZADOS (use EXATAMENTE estas grafias — capitalização importa):
- "Status da prospecção": "Prospectar" | "Em prospecção" | "Fazendo Orçamento" | "Orçamento Enviado" | "Fechado" | "Perdido"
- "Classificação da obra": "Baixo" | "Médio" | "Médio/Alto" | "Alto"
- "Produto Oferecido" (multi, vírgula+espaço): "IMAB" | "RHODEN" | "PRADO" | "Nenhum"
  - Exemplos válidos: "IMAB", "PRADO, IMAB", "RHODEN, PRADO"
- "Visita": "Visitado" | "Não visitado"
- "Marcou Reunião?": "Sim" | "Não"
- DATAS: SEMPRE no formato BR DD/MM/AAAA. Exemplo: "30/04/2026". NUNCA use YYYY-MM-DD.
  - "hoje" / "ontem" / "amanhã" → calcule a partir de DATA_ATUAL e formate DD/MM/AAAA.

LINKS / ORÇAMENTOS:
- "imab" → "Link do orçamento/PDF IMAB" + adicionar "IMAB" em Produto Oferecido.
- "rhoden" → "Link do orçamento/PDF RHODEN" + adicionar "RHODEN" em Produto Oferecido.
- "prado" → "Link do orçamento/PDF PRADO" + adicionar "PRADO" em Produto Oferecido.
- Marca ambígua → modo "perguntar".

ARQUIVOS ANEXADOS PELO USUÁRIO:
- Quando a mensagem contiver um bloco "[ARQUIVOS ANEXADOS]" com linhas no formato "- nome.pdf: https://...", trate cada URL como o link do orçamento correspondente.
- Identifique a marca pelo NOME do arquivo OU pelo texto do usuário (ex: "imab.pdf", "orçamento rhoden", "prado_aurora.xlsx"). Se identificar, preencha o campo de Link da marca + adicione a marca em "Produto Oferecido".
- Se houver MÚLTIPLOS arquivos com marcas diferentes, preencha todos os links correspondentes.
- Se a marca for ambígua (nome genérico tipo "orcamento.pdf" sem contexto) → modo "perguntar" listando IMAB / RHODEN / PRADO.
- Nunca descarte uma URL anexada — ela DEVE acabar em algum campo.

LOCALIZAÇÃO (REGRA OBRIGATÓRIA — nunca pule):
- Sempre que houver cidade, bairro, endereço ou ponto de referência, "Localização/Bairro Obra" DEVE ser um LINK no formato exato:
  https://www.google.com/maps?q=texto+formatado
- Formatação do "texto+formatado": tudo minúsculo, sem acentos (ex: "jundiaí"→"jundiai"), espaços viram "+", junte cidade+bairro.
- "Cidade Obra" recebe o nome com capitalização e acentos normais (ex: "Jundiaí").
- ❌ ERRADO: "Localização/Bairro Obra": "Taquaral"
- ❌ ERRADO: "Localização/Bairro Obra": "Jundiaí - Eloy Chaves"
- ✅ CERTO: "Localização/Bairro Obra": "https://www.google.com/maps?q=campinas+taquaral"
- ✅ CERTO: "Localização/Bairro Obra": "https://www.google.com/maps?q=jundiai+eloy+chaves"

EXTRAÇÃO INTELIGENTE:
- "obra em campinas, cliente mrv, já visitei, orçamento imab https://..." → cidade, link maps, construtora, visita, produto, link.
- "já visitei"/"fui na obra"/"visita feita" → "Visita": "Visitado".
- Nomes comuns de construtoras (MRV, Cyrela, Tenda, MDL, Direcional) → "Construtora/Cliente".
- NUNCA infira "Status da prospecção" automaticamente a partir de outro campo (ex: ter link de orçamento NÃO implica "Fazendo Orçamento"). Só preencha Status se o usuário disser explicitamente.
- Mensagens caóticas / transcrição de áudio com correção ("amanhã não, ontem", "coloca X, na verdade Y"): sempre use o ÚLTIMO valor mencionado pelo usuário (a correção).

FORMATOS DE RESPOSTA (escolha UM):

Editar:
{"modo":"editar","id":"OBRA000000012","campos":{"Status da prospecção":"Fechado"},"mensagem":"Abrindo a obra 12 pra você confirmar."}

Nova (com link do Maps):
{"modo":"nova","campos":{"Cidade Obra":"Campinas","Localização/Bairro Obra":"https://www.google.com/maps?q=campinas+taquaral","Construtora/Cliente":"MRV","Visita":"Visitado","Produto Oferecido":"IMAB","Link do orçamento/PDF IMAB":"https://drive.google.com/abc"},"mensagem":"Pré-preenchendo nova obra."}

Executar (atualizar direto):
{"modo":"executar","id":"OBRA000000003","campos":{"Próximo contato/Follow up":"30/04/2026"},"mensagem":"Atualizei o follow-up da obra 3 pra 30/04/2026."}

Executar (criar direto):
{"modo":"executar","criar":true,"campos":{"Nome da obra":"Aurora","Cidade Obra":"Campinas","Localização/Bairro Obra":"https://www.google.com/maps?q=campinas"},"mensagem":"Obra Aurora criada."}

Analisar:
{"modo":"analisar","consulta":"obras com status fechado por cidade","mensagem":"Vou checar isso."}

Perguntar:
{"modo":"perguntar","mensagem":"Esse orçamento é IMAB, RHODEN ou PRADO?"}

Conversa:
{"modo":"conversa","mensagem":"Posso criar, editar, salvar direto ou analisar obras pra você."}

Conversa salvando dica:
{"modo":"conversa","salvarDica":"Toda obra MRV é classificação Alto e produto IMAB.","mensagem":"Anotado!"}

============================================================
ABA "ATIVIDADES" (CRM por obra) — controle de histórico de contatos
============================================================

CAMPOS DE ATIVIDADE (use exatamente estes nomes em "atividade"):
- "idObra": ID da obra (OBRA + 9 dígitos). OBRIGATÓRIO em criar.
- "tipoContato": "ligação" | "whatsapp" | "email" | "visita" (minúsculo)
- "status": texto livre curto (ex: "sem retorno", "interessado", "aguardando aprovação")
- "comentario": texto livre — o que foi conversado/registrado
- "proximoContato": data DD/MM/AAAA (opcional — pode ficar vazio)
- "dataAtividade": DD/MM/AAAA (opcional — se omitido vira hoje)

QUANDO USAR CADA MODO DE ATIVIDADE:
- "atividade-nova" → registrar nova atividade na obra. Forneça "atividade" com idObra + campos.
  Ex de gatilhos: "registra uma ligação na obra 12", "anota visita feita ontem na obra Aurora", "adiciona atividade".
  ⚠️ Se a atividade tiver "proximoContato", o sistema automaticamente atualiza o follow-up da obra.
- "atividade-editar" → alterar atividade existente. Forneça "idAtividade" (formato ATIV000001) e "atividade" com os campos a alterar.
  Ex: "edita a última atividade da obra 5 e muda o status para fechado".
  Se o usuário se referir à "última atividade" sem dar o ID, use modo "analisar" com "consulta": "ultima atividade da obra <id>" para o sistema te trazer os dados, depois confirme com "atividade-editar".
- "atividade-excluir" → remover atividade. Forneça "idAtividade".
- "atividade-listar" → mostrar histórico. Forneça "idObra" em "atividade".

EXEMPLOS DE ATIVIDADES:

Criar atividade simples:
{"modo":"atividade-nova","atividade":{"idObra":"OBRA000000012","tipoContato":"ligação","status":"sem retorno","comentario":"Liguei e caiu na caixa postal"},"mensagem":"Registrei a ligação na obra 12."}

Criar atividade com follow-up:
{"modo":"atividade-nova","atividade":{"idObra":"OBRA000000003","tipoContato":"whatsapp","status":"interessado","comentario":"Mandei orçamento, vai analisar","proximoContato":"05/05/2026"},"mensagem":"Atividade registrada e follow-up agendado pra 05/05/2026."}

Editar atividade conhecida:
{"modo":"atividade-editar","idAtividade":"ATIV000005","atividade":{"status":"fechado","comentario":"Aprovou o orçamento"},"mensagem":"Atividade ATIV000005 atualizada."}

Excluir atividade:
{"modo":"atividade-excluir","idAtividade":"ATIV000007","mensagem":"Atividade ATIV000007 excluída."}

Listar atividades de uma obra:
{"modo":"atividade-listar","atividade":{"idObra":"OBRA000000003"},"mensagem":"Buscando o histórico da obra 3."}`;
}

interface AiMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface SecretariaAction {
  modo: string;
  id?: string;
  campos?: Record<string, string>;
  criar?: boolean;
  consulta?: string;
  mensagem?: string;
  salvarDica?: string;
  limparDicas?: boolean;
  // ===== Atividades =====
  idAtividade?: string;
  atividade?: Record<string, string>;
}

// ===== Server-side normalization (defense in depth) =====
const STATUS_MAP: Record<string, string> = {
  "prospectar": "Prospectar",
  "em prospeccao": "Em prospecção",
  "em prospecção": "Em prospecção",
  "fazendo orcamento": "Fazendo Orçamento",
  "fazendo orçamento": "Fazendo Orçamento",
  "orcamento enviado": "Orçamento Enviado",
  "orçamento enviado": "Orçamento Enviado",
  "fechado": "Fechado",
  "perdido": "Perdido",
};
const CLASSIF_MAP: Record<string, string> = {
  "baixo": "Baixo",
  "medio": "Médio",
  "médio": "Médio",
  "medio/alto": "Médio/Alto",
  "médio/alto": "Médio/Alto",
  "medio alto": "Médio/Alto",
  "alto": "Alto",
};
const PRODUTO_MAP: Record<string, string> = {
  "imab": "IMAB",
  "rhoden": "RHODEN",
  "prado": "PRADO",
  "nenhum": "Nenhum",
};
const VISITA_MAP: Record<string, string> = {
  "visitado": "Visitado",
  "nao visitado": "Não visitado",
  "não visitado": "Não visitado",
};
const REUNIAO_MAP: Record<string, string> = {
  "sim": "Sim",
  "nao": "Não",
  "não": "Não",
};

function normalizeFromMap(value: string, map: Record<string, string>): string {
  const k = value.trim().toLowerCase();
  return map[k] ?? value.trim();
}

function normalizeProduto(raw: string): string {
  return raw
    .split(/[,;]+/)
    .map((p) => normalizeFromMap(p, PRODUTO_MAP))
    .filter(Boolean)
    .join(", ");
}

function normalizeDateBR(raw: string): string {
  const v = raw.trim();
  // YYYY-MM-DD → DD/MM/YYYY
  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  // Already DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) return v;
  // D/M/YYYY → pad
  const loose = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (loose) {
    return `${loose[1].padStart(2, "0")}/${loose[2].padStart(2, "0")}/${loose[3]}`;
  }
  return v;
}

function normalizeId(raw: string): string {
  const cleaned = raw.trim().toUpperCase();
  const m = cleaned.match(/^OBRA0*(\d+)$/);
  if (m) return `OBRA${m[1].padStart(9, "0")}`;
  const digits = cleaned.match(/\d+/);
  if (digits && cleaned.includes("OBRA")) {
    return `OBRA${digits[0].padStart(9, "0")}`;
  }
  return raw;
}

const DATE_FIELDS = new Set([
  "Data de cadastro",
  "Data da última visita",
  "Data orçamento enviado",
  "Próximo contato/Follow up",
]);

function normalizeAtivId(raw: string): string {
  const cleaned = raw.trim().toUpperCase();
  const m = cleaned.match(/^ATIV0*(\d+)$/);
  if (m) return `ATIV${m[1].padStart(6, "0")}`;
  const digits = cleaned.match(/\d+/);
  if (digits && cleaned.includes("ATIV")) {
    return `ATIV${digits[0].padStart(6, "0")}`;
  }
  return raw;
}

function sanitizeAction(action: SecretariaAction): SecretariaAction {
  if (action.id) action.id = normalizeId(action.id);
  if (action.campos && typeof action.campos === "object") {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(action.campos)) {
      if (v == null) continue;
      let val = String(v);
      if (k === "Status da prospecção") val = normalizeFromMap(val, STATUS_MAP);
      else if (k === "Classificação da obra") val = normalizeFromMap(val, CLASSIF_MAP);
      else if (k === "Produto Oferecido") val = normalizeProduto(val);
      else if (k === "Visita") val = normalizeFromMap(val, VISITA_MAP);
      else if (k === "Marcou Reunião?") val = normalizeFromMap(val, REUNIAO_MAP);
      else if (DATE_FIELDS.has(k)) val = normalizeDateBR(val);
      out[k] = val;
    }
    action.campos = out;
  }
  if (action.idAtividade) action.idAtividade = normalizeAtivId(action.idAtividade);
  if (action.atividade && typeof action.atividade === "object") {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(action.atividade)) {
      if (v == null) continue;
      let val = String(v);
      if (k === "idObra") val = normalizeId(val);
      else if (k === "tipoContato") val = val.trim().toLowerCase();
      else if (k === "proximoContato" || k === "dataAtividade") val = normalizeDateBR(val);
      out[k] = val;
    }
    action.atividade = out;
  }
  return action;
}

async function callAI(messages: AiMessage[], apiKey: string): Promise<SecretariaAction> {
  const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "system", content: buildSystemPrompt() }, ...messages],
      response_format: { type: "json_object" },
    }),
  });

  if (!aiResp.ok) {
    const t = await aiResp.text();
    console.error("AI gateway error", aiResp.status, t);
    const err: Error & { status?: number } = new Error(
      aiResp.status === 429
        ? "Limite de requisições atingido. Aguarde um instante."
        : aiResp.status === 402
          ? "Créditos esgotados na Lovable AI."
          : "AI gateway error",
    );
    err.status = aiResp.status;
    throw err;
  }

  const data = await aiResp.json();
  const raw = data?.choices?.[0]?.message?.content ?? "{}";
  let parsed: SecretariaAction;
  try {
    parsed = JSON.parse(raw) as SecretariaAction;
  } catch {
    parsed = { modo: "conversa", mensagem: String(raw) };
  }
  return sanitizeAction(parsed);
}

async function fetchAtividadesPorObra(idObra: string): Promise<string> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !anonKey) return "";
    const r = await fetch(
      `${supabaseUrl}/functions/v1/atividades?idObra=${encodeURIComponent(idObra)}`,
      { headers: { Authorization: `Bearer ${anonKey}`, apikey: anonKey } },
    );
    if (!r.ok) return "";
    const list = await r.json();
    if (!Array.isArray(list)) return "";
    return JSON.stringify(list);
  } catch (e) {
    console.error("fetchAtividadesPorObra error", e);
    return "";
  }
}

async function fetchObrasSummary(): Promise<string> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !anonKey) return "";
    const r = await fetch(`${supabaseUrl}/functions/v1/obras`, {
      headers: { Authorization: `Bearer ${anonKey}`, apikey: anonKey },
    });
    if (!r.ok) return "";
    const list = await r.json();
    if (!Array.isArray(list)) return "";
    const compact = list.map((o: Record<string, string>) => ({
      id: o.codigoObra,
      nome: o.nome,
      cidade: o.cidade,
      construtora: o.construtora,
      status: o.statusProspeccao,
      visita: o.visita,
      classificacao: o.classificacao,
      produto: o.produtoOferecido,
      proxContato: o.proximoContato,
      ultimaVisita: o.dataUltimaVisita,
      orcamentoEnviado: o.dataOrcamentoEnviado,
    }));
    return JSON.stringify(compact);
  } catch (e) {
    console.error("fetchObrasSummary error", e);
    return "";
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = (await req.json()) as { messages: AiMessage[] };
    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let action: SecretariaAction;
    try {
      action = await callAI(messages, LOVABLE_API_KEY);
    } catch (e) {
      const err = e as Error & { status?: number };
      const status = err.status ?? 500;
      return new Response(JSON.stringify({ error: err.message }), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action.modo === "analisar") {
      const summary = await fetchObrasSummary();
      const followup: AiMessage[] = [
        ...messages,
        {
          role: "system",
          content: `DADOS_OBRAS (JSON, todas as obras cadastradas):\n${summary}\n\nResponda à consulta usando APENAS esses dados. Regras de formatação:
- Sempre liste obras pelo NOME ("nome"). Só inclua o ID entre parênteses se o usuário pedir.
- Se forem mais de 3 itens, use bullets (- item) em linhas separadas.
- Se nenhum item bater, diga claramente "Nenhuma obra encontrada com esses critérios."
- Para contagens, dê o número e exemplos: "Temos 5 obras em Campinas: Aurora, Sensia, Solar..."
- Texto natural em português, modo "conversa", sem aspas literais. Não invente nada que não esteja em DADOS_OBRAS.`,
        },
      ];
      try {
        action = await callAI(followup, LOVABLE_API_KEY);
      } catch (e) {
        const err = e as Error;
        action = { modo: "conversa", mensagem: `Não consegui analisar agora: ${err.message}` };
      }
    }

    if (action.modo === "atividade-listar" && action.atividade?.idObra) {
      const idObra = action.atividade.idObra;
      const ativs = await fetchAtividadesPorObra(idObra);
      const followup: AiMessage[] = [
        ...messages,
        {
          role: "system",
          content: `DADOS_ATIVIDADES da obra ${idObra} (JSON):\n${ativs}\n\nResponda em modo "conversa" (texto natural em português) listando as atividades em ordem cronológica decrescente. Cada item: data, tipo, status (se houver), comentário curto, e se houver próximo contato. Se vazio, diga "nenhuma atividade registrada". Se o usuário pediu para identificar/editar uma atividade específica (ex: "última"), inclua o idAtividade dela ao final em parênteses para o usuário confirmar.`,
        },
      ];
      try {
        action = await callAI(followup, LOVABLE_API_KEY);
      } catch (e) {
        const err = e as Error;
        action = { modo: "conversa", mensagem: `Não consegui listar agora: ${err.message}` };
      }
    }

    return new Response(JSON.stringify({ action }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("secretaria error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
