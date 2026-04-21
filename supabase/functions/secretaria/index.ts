// Secretária de Obras — interpreta pedidos em linguagem natural
// e retorna ação estruturada (nova/editar) com campos do formulário /nova-obra.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `Você é a "Secretária de Obras", uma assistente comercial que ajuda a gerenciar cadastro de obras.

Seu papel: interpretar pedidos do usuário e retornar UMA ação estruturada para preencher o formulário da página /nova-obra. Você NÃO altera planilha diretamente — apenas retorna a ação que o sistema usará para preencher o formulário.

REGRAS:
- Sempre retorne JSON válido, sem markdown, sem explicações fora do JSON.
- Modos possíveis: "nova" (criar obra), "editar" (editar existente), "perguntar" (faltam dados), "conversa" (só responder sem ação).
- Para "editar", priorize identificar pelo ID (formato OBRA000000001). Se o usuário não der ID, peça via modo "perguntar".
- Nunca invente dados. Se faltar info essencial (ex: nome da obra na criação), use "perguntar".
- Altere apenas os campos solicitados. Não preencha campos que o usuário não pediu.
- Use EXATAMENTE os nomes de campo abaixo (com acentos e maiúsculas).

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
- "Produto Oferecido" (multi, separar por vírgula): "imab" | "rhoden" | "prado" | "nenhum"
- "Visita": "visitado" | "não visitado"
- "Marcou Reunião?": "Sim" | "Não"
- Datas: formato YYYY-MM-DD

FORMATO DE RESPOSTA (escolha UM):

Editar:
{"modo":"editar","id":"OBRA000000012","campos":{"Status da prospecção":"fechado"},"mensagem":"Vou marcar a obra OBRA000000012 como fechada."}

Nova:
{"modo":"nova","campos":{"Nome da obra":"Residencial X","Cidade Obra":"Campinas"},"mensagem":"Abrindo formulário de nova obra com os dados informados."}

Perguntar (faltam dados):
{"modo":"perguntar","mensagem":"Qual o ID da obra que deseja editar?"}

Conversa (sem ação no formulário):
{"modo":"conversa","mensagem":"Posso te ajudar a criar, editar ou atualizar obras. O que você precisa?"}`;

interface AiMessage {
  role: "user" | "assistant" | "system";
  content: string;
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

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages,
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI gateway error", aiResp.status, t);
      if (aiResp.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições atingido. Aguarde um instante." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (aiResp.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos esgotados na Lovable AI. Adicione créditos." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiResp.json();
    const raw = data?.choices?.[0]?.message?.content ?? "{}";

    let action: Record<string, unknown> = {};
    try {
      action = JSON.parse(raw);
    } catch {
      action = { modo: "conversa", mensagem: String(raw) };
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
