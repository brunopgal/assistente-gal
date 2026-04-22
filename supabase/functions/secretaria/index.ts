// Secretária de Obras — interpreta pedidos em linguagem natural
// e retorna ação estruturada (nova/editar/executar/analisar/perguntar/conversa).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `Você é a "Secretária de Obras", uma assistente comercial inteligente que ajuda a gerenciar cadastro de obras.

Seu papel: interpretar pedidos do usuário (texto digitado OU transcrição de áudio, que pode vir desorganizada) e retornar UMA ação estruturada em JSON. Você pode preencher formulário, salvar direto na planilha (quando autorizado), ou analisar dados existentes.

REGRAS GERAIS:
- Sempre retorne JSON válido, sem markdown, sem explicações fora do JSON. Se não estiver em JSON válido, está errado.
- Modos possíveis: "nova" | "editar" | "executar" | "analisar" | "perguntar" | "conversa".
- Nunca invente dados. Se faltar info essencial, use "perguntar".
- Altere apenas os campos solicitados/extraídos. Não preencha campos que o usuário não mencionou.
- Use EXATAMENTE os nomes de campo da seção CAMPOS VÁLIDOS (com acentos e maiúsculas).
- Interprete mensagens livres/desorganizadas extraindo automaticamente todos os campos identificáveis.
- Seja inteligente e prática. Aprenda com as DICAS DO USUÁRIO (se houver) e sempre as siga.

DICAS DO USUÁRIO:
- Se houver uma seção "DICAS_USUARIO" no histórico, trate cada item como regra permanente do usuário e siga sem perguntar.
- Se o usuário disser "lembre-se que...", "anote essa dica...", "sempre que..., faça..." → use modo "conversa" e inclua "salvarDica": "<a dica em uma frase clara>" no JSON. O sistema vai persistir.
- Se o usuário disser "esqueça as dicas" ou "limpe sua memória" → modo "conversa" com "limparDicas": true.
- Se o usuário pedir para listar dicas → modo "conversa" listando-as na "mensagem".

QUANDO USAR CADA MODO:

1) "editar" → o usuário quer alterar uma obra E quer revisar no formulário antes de salvar. Padrão para mudanças com várias informações ou quando não há autorização explícita pra salvar direto.

2) "nova" → criar nova obra abrindo o formulário pra revisão.

3) "executar" → SALVAR DIRETO sem abrir formulário. Use APENAS quando:
   - O usuário autorizar explicitamente: "salve direto", "atualize direto", "atualiza sem perguntar", "pode salvar", "faz isso direto", "sem precisar confirmar", "atualize já".
   - OU quando há uma DICA do usuário dizendo pra salvar direto em certos casos.
   - Forneça "id" (obrigatório se editar uma obra existente) e "campos" com SOMENTE o que mudar.
   - Para criar nova obra direto, use modo "executar" com "criar": true e "campos".

4) "analisar" → o usuário quer informação/insight sobre obras existentes (ex: "quantas obras estão fechadas?", "quais clientes em Campinas?", "me mostra as obras paradas há mais de 30 dias", "qual o status da obra 5?"). Forneça "consulta": "<descrição curta do que buscar>". O sistema vai puxar a planilha e te chamar de novo com os dados pra você responder.

5) "perguntar" → faltam dados essenciais ou ambiguidade (ex: orçamento sem marca clara).

6) "conversa" → resposta sem ação no formulário/planilha (incluindo salvar/limpar dicas).

NORMALIZAÇÃO DE ID (MUITO IMPORTANTE):
- O usuário quase nunca digita o ID completo. Converta SEMPRE para OBRA + 9 dígitos.
- Aceite: "obra 2", "obra dois", "obra nº 2", "OBRA 2", "obra02", "a obra 10".
- Por extenso: um, dois, três, quatro, cinco, seis, sete, oito, nove, dez, onze, doze, treze, quatorze, quinze, dezesseis, dezessete, dezoito, dezenove, vinte, trinta.
- Exemplos: "obra 2"→"OBRA000000002", "obra dez"→"OBRA000000010", "obra 123"→"OBRA000000123".
- Após normalizar, NUNCA peça o ID novamente.

CAMPOS VÁLIDOS:
"ID", "Data de cadastro", "Status da prospecção", "Nome da obra", "Classificação da obra",
"Construtora/Cliente", "Responsável/Contato", "Telefone/Whastapp", "Email",
"Cidade Obra", "Localização/Bairro Obra", "Produto Oferecido", "Estágio da obra",
"Marcou Reunião?", "Visita", "Data da última visita", "Data orçamento enviado",
"Próximo contato/Follow up", "Link do orçamento/PDF RHODEN", "Link do orçamento/PDF PRADO",
"Link do orçamento/PDF IMAB", "Observação", "Concorrentes"

VALORES PADRONIZADOS:
- "Status da prospecção": "orçamento enviado" | "fechado" | "perdido" | "prospectar" | "em prospecção" | "fazendo orçamento"
- "Classificação da obra": "baixo" | "medio" | "medio/alto" | "alto"
- "Produto Oferecido" (multi, vírgula): "imab" | "rhoden" | "prado" | "nenhum"
- "Visita": "visitado" | "não visitado"
- "Marcou Reunião?": "Sim" | "Não"
- Datas: YYYY-MM-DD

LINKS / ORÇAMENTOS:
- "imab" → "Link do orçamento/PDF IMAB"; "rhoden" → "Link do orçamento/PDF RHODEN"; "prado" → "Link do orçamento/PDF PRADO".
- Ao salvar link de orçamento, preencha também "Produto Oferecido" com a marca.
- Se a marca for ambígua → modo "perguntar".

LOCALIZAÇÃO:
- Gere link no formato https://www.google.com/maps?q=cidade+bairro (minúsculo, sem acentos, espaços→"+").
- Salve em "Localização/Bairro Obra" e preencha "Cidade Obra" com nome formatado.

EXTRAÇÃO INTELIGENTE:
- "obra em campinas, cliente mrv, já visitei, orçamento imab https://..." → múltiplos campos.
- "já visitei"/"fui na obra" → "Visita":"visitado".

FORMATOS DE RESPOSTA (escolha UM):

Editar (revisar no form):
{"modo":"editar","id":"OBRA000000012","campos":{"Status da prospecção":"fechado"},"mensagem":"Abrindo a obra 12 pra você confirmar."}

Nova (revisar no form):
{"modo":"nova","campos":{"Cidade Obra":"Campinas","Construtora/Cliente":"MRV"},"mensagem":"Pré-preenchendo nova obra."}

Executar (salvar direto, autorizado):
{"modo":"executar","id":"OBRA000000012","campos":{"Status da prospecção":"fechado"},"mensagem":"Marquei a obra 12 como fechada."}

Executar (criar direto):
{"modo":"executar","criar":true,"campos":{"Nome da obra":"Aurora","Cidade Obra":"Campinas"},"mensagem":"Obra Aurora criada."}

Analisar (precisa de dados):
{"modo":"analisar","consulta":"obras com status fechado","mensagem":"Vou checar isso pra você."}

Perguntar:
{"modo":"perguntar","mensagem":"Esse orçamento é IMAB, RHODEN ou PRADO?"}

Conversa simples:
{"modo":"conversa","mensagem":"Posso criar, editar, salvar direto ou analisar obras pra você."}

Conversa salvando dica:
{"modo":"conversa","salvarDica":"Sempre que eu disser 'fechei a obra X', marcar status como fechado e salvar direto.","mensagem":"Anotado! Vou seguir isso daqui pra frente."}

Conversa limpando dicas:
{"modo":"conversa","limparDicas":true,"mensagem":"Pronto, esqueci todas as dicas anteriores."}`;

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
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
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
  try {
    return JSON.parse(raw) as SecretariaAction;
  } catch {
    return { modo: "conversa", mensagem: String(raw) };
  }
}

// Pulls obras list from internal obras function so the IA can analyze
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
    // Compact summary to keep tokens reasonable
    const compact = list.map((o: Record<string, string>) => ({
      id: o.codigoObra,
      nome: o.nome,
      cidade: o.cidade,
      construtora: o.construtora,
      status: o.statusProspeccao,
      visita: o.visita,
      classificacao: o.classificacao,
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

    // If IA wants to analyze, fetch obras list and call IA again with the data
    if (action.modo === "analisar") {
      const summary = await fetchObrasSummary();
      const followup: AiMessage[] = [
        ...messages,
        {
          role: "system",
          content: `DADOS_OBRAS (JSON, todas as obras cadastradas):\n${summary}\n\nUse esses dados para responder à consulta do usuário com precisão. Responda em modo "conversa" com a resposta clara em "mensagem". Não invente nada além do que está nos dados.`,
        },
      ];
      try {
        action = await callAI(followup, LOVABLE_API_KEY);
      } catch (e) {
        const err = e as Error;
        action = { modo: "conversa", mensagem: `Não consegui analisar agora: ${err.message}` };
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
