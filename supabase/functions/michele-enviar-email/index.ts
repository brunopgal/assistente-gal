// Edge function: michele-enviar-email
// Envia e-mail de prospecção via Resend, registra atividade e log.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function todayBR(): string {
  return new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

async function generateNextAtivId(sb: any): Promise<string> {
  const { data } = await sb
    .from("atividades")
    .select("idAtividade")
    .ilike("idAtividade", "ATIV%")
    .order("idAtividade", { ascending: false })
    .limit(50);
  let max = 0;
  for (const r of (data as any[]) ?? []) {
    const m = /^ATIV0*(\d+)$/i.exec(String(r.idAtividade ?? ""));
    if (m) max = Math.max(max, Number(m[1]));
  }
  return "ATIV" + String(max + 1).padStart(6, "0");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

  if (!RESEND_API_KEY) return json({ error: "RESEND_API_KEY não configurada" }, 500);

  const userClient = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: claims, error: authErr } = await userClient.auth.getClaims(authHeader.slice(7));
  if (authErr || !claims?.claims) return json({ error: "Unauthorized" }, 401);

  const sb = createClient(SUPABASE_URL, SERVICE);

  let body: {
    codigoObra?: string;
    destinatario_email?: string;
    destinatario_nome?: string;
    assunto?: string;
    corpo_html?: string;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "JSON inválido" }, 400);
  }

  const codigoObra = String(body.codigoObra ?? "").trim();
  const destinatario_email = String(body.destinatario_email ?? "").trim();
  const destinatario_nome = String(body.destinatario_nome ?? "").trim();
  const assunto = String(body.assunto ?? "").trim();
  let corpo_html = String(body.corpo_html ?? "").trim();

  if (!codigoObra) return json({ error: "codigoObra é obrigatório" }, 400);
  if (!destinatario_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destinatario_email)) {
    return json({ error: "destinatario_email inválido" }, 400);
  }
  if (!assunto) return json({ error: "assunto é obrigatório" }, 400);
  if (!corpo_html) return json({ error: "corpo_html é obrigatório" }, 400);

  // Garante que o link do site rastreado esteja no corpo
  const linkRastreado = `https://galrepresentacoes.lovable.app?ref=${encodeURIComponent(codigoObra)}`;
  if (!corpo_html.includes("galrepresentacoes.lovable.app")) {
    corpo_html += `<p><a href="${linkRastreado}">Conheça a Gal Representações</a></p>`;
  } else {
    // Substitui placeholder CODIGOOBRA caso modelo o tenha incluído literalmente
    corpo_html = corpo_html.replace(/CODIGOOBRA/g, encodeURIComponent(codigoObra));
  }

  // Verifica se a obra existe
  const { data: obra, error: obraErr } = await sb
    .from("obras")
    .select("codigoObra,nome")
    .eq("codigoObra", codigoObra)
    .maybeSingle();
  if (obraErr) return json({ error: obraErr.message }, 500);
  if (!obra) return json({ error: `Obra ${codigoObra} não encontrada` }, 404);

  // Envia via Resend
  let resendData: any = null;
  try {
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Michele - Gal Representações <michele@galrepresentacoes.com.br>",
        to: destinatario_nome
          ? [`${destinatario_nome} <${destinatario_email}>`]
          : [destinatario_email],
        reply_to: "michele.obras.gal@gmail.com",
        subject: assunto,
        html: corpo_html,
        tags: [
          { name: "codigoObra", value: codigoObra },
          { name: "origem", value: "michele" },
        ],
        tracking: { opens: true, clicks: true },
      }),
    });
    resendData = await resendRes.json().catch(() => ({}));
    if (!resendRes.ok) {
      const msg = resendData?.message || resendData?.error || `Resend HTTP ${resendRes.status}`;
      await sb.from("log_automacao").insert({
        codigoObra,
        tipo_acao: "enviar_email",
        descricao: `Falha ao enviar e-mail para ${destinatario_email}`,
        sucesso: false,
        mensagem_erro: String(msg),
        dados_json: { destinatario_email, assunto, resendData },
        criado_por: "michele",
      });
      return json({ error: `Resend: ${msg}` }, 502);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await sb.from("log_automacao").insert({
      codigoObra,
      tipo_acao: "enviar_email",
      descricao: `Erro ao chamar Resend para ${destinatario_email}`,
      sucesso: false,
      mensagem_erro: msg,
      dados_json: { destinatario_email, assunto },
      criado_por: "michele",
    });
    return json({ error: `Erro Resend: ${msg}` }, 500);
  }

  const emailId = resendData?.id ?? null;

  // Registra atividade
  try {
    const idAtividade = await generateNextAtivId(sb);
    await sb.from("atividades").insert({
      idAtividade,
      idObra: codigoObra,
      dataAtividade: todayBR(),
      tipoContato: "email",
      status: "enviado",
      proximoContato: "",
      comentario: `E-mail enviado para ${destinatario_nome || destinatario_email} <${destinatario_email}> — Assunto: ${assunto}${emailId ? ` · resend_id: ${emailId}` : ""}`,
    });

    // Cria follow-up automático se não existir um pendente do mesmo tipo
    const { data: existingFollowUp } = await sb
      .from("follow_ups")
      .select("id")
      .eq("codigoObra", codigoObra)
      .eq("tipo", "checar_resposta_email")
      .eq("status", "pendente")
      .maybeSingle();

    if (!existingFollowUp) {
      const date2Days = new Date();
      date2Days.setDate(date2Days.getDate() + 2);
      const data_prevista = date2Days.toISOString().split("T")[0]; // formato YYYY-MM-DD

      await sb.from("follow_ups").insert({
        codigoObra,
        tipo: "checar_resposta_email",
        descricao: "Verificar se respondeu o e-mail enviado",
        data_prevista,
        canal_sugerido: "email",
        prioridade: "normal",
        responsavel: "michele",
        status: "pendente",
      });
    }
  } catch (e) {
    console.warn("Falha ao registrar atividade ou criar follow-up:", e);
  }

  await sb.from("log_automacao").insert({
    codigoObra,
    tipo_acao: "enviar_email",
    descricao: `E-mail enviado para ${destinatario_email} (assunto: ${assunto})`,
    sucesso: true,
    dados_json: { destinatario_email, destinatario_nome, assunto, resend_id: emailId },
    criado_por: "michele",
  });

  return json({
    ok: true,
    resumo: `E-mail enviado para ${destinatario_nome || destinatario_email}.`,
    resend_id: emailId,
  });
});
