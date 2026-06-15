import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DEFAULT_SYSTEM_PROMPT =
  "Você é Michele, assistente de prospecção da Gal Representações. Ajude Bruno com prospecção de obras, follow-ups e relacionamento com construtoras. Seja objetiva, cordial e proativa.";

// Parse DD/MM/AAAA -> Date or null
function parseBR(d: string | null | undefined): Date | null {
  if (!d || typeof d !== "string") return null;
  const m = d.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const dt = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return isNaN(dt.getTime()) ? null : dt;
}

async function buildContext(
  supa: ReturnType<typeof createClient>,
  lastUserMsg: string,
): Promise<string> {
  const parts: string[] = [];
  parts.push("CONTEXTO ATUAL DO CRM (dados reais de agora):");

  try {
    // Obras por statusProspeccao + fase_michele
    const { data: obrasAll } = await supa
      .from("obras")
      .select("statusProspeccao, fase_michele, nome, responsavel, data_proxima_acao");

    const obras = obrasAll ?? [];

    const byStatus: Record<string, number> = {};
    const byFase: Record<string, number> = {};
    for (const o of obras as any[]) {
      const s = o.statusProspeccao || "(sem status)";
      const f = o.fase_michele || "(sem fase)";
      byStatus[s] = (byStatus[s] ?? 0) + 1;
      byFase[f] = (byFase[f] ?? 0) + 1;
    }

    parts.push(`\nObras por statusProspeccao (total ${obras.length}):`);
    for (const [k, v] of Object.entries(byStatus)) parts.push(`  - ${k}: ${v}`);

    parts.push(`\nObras por fase_michele:`);
    for (const [k, v] of Object.entries(byFase)) parts.push(`  - ${k}: ${v}`);

    // Construtoras
    const { count: totalConstrutoras } = await supa
      .from("construtoras")
      .select("*", { count: "exact", head: true });
    parts.push(`\nTotal de construtoras: ${totalConstrutoras ?? 0}`);

    // Top 5 obras por data_proxima_acao (vencidas/próximas)
    const hoje = new Date();
    const comData = (obras as any[])
      .map((o) => ({ ...o, _dt: parseBR(o.data_proxima_acao) }))
      .filter((o) => o._dt !== null)
      .sort((a, b) => a._dt!.getTime() - b._dt!.getTime())
      .slice(0, 5);

    parts.push(`\n5 obras com data_proxima_acao mais urgente:`);
    if (comData.length === 0) {
      parts.push("  (nenhuma com data definida)");
    } else {
      for (const o of comData) {
        const atraso = Math.floor((hoje.getTime() - o._dt!.getTime()) / 86400000);
        const tag = atraso > 0 ? `atrasada ${atraso}d` : `em ${-atraso}d`;
        parts.push(
          `  - ${o.nome} | resp: ${o.responsavel ?? "-"} | fase: ${o.fase_michele ?? "-"} | ${o.data_proxima_acao} (${tag})`,
        );
      }
    }

    // Follow-ups pendentes (view)
    const { data: fups } = await supa
      .from("vw_followups_pendentes")
      .select("nome_obra, responsavel, descricao, data_prevista, dias_atraso, prioridade, canal_sugerido")
      .order("dias_atraso", { ascending: false })
      .limit(10);

    parts.push(`\nFollow-ups pendentes (top 10 mais atrasados):`);
    if (!fups || fups.length === 0) {
      parts.push("  (nenhum pendente)");
    } else {
      for (const f of fups as any[]) {
        parts.push(
          `  - ${f.nome_obra ?? "-"} | ${f.responsavel ?? "-"} | ${f.descricao ?? "-"} | prev ${f.data_prevista ?? "-"} | atraso ${f.dias_atraso ?? 0}d | ${f.prioridade ?? "-"} | ${f.canal_sugerido ?? "-"}`,
        );
      }
    }
  } catch (e) {
    console.error("Erro montando contexto leve:", e);
    parts.push("\n(erro ao carregar resumo do banco)");
  }

  // Detalhe sob demanda
  try {
    const texto = (lastUserMsg || "").trim();
    if (texto.length >= 3) {
      const { data: obrasNomes } = await supa.from("obras").select("nome");
      const { data: construtorasNomes } = await supa.from("construtoras").select("nome");

      const lower = texto.toLowerCase();
      const matchedObra = (obrasNomes as any[] | null)?.find(
        (o) => o.nome && lower.includes(String(o.nome).toLowerCase()),
      );
      const matchedConstrutora = (construtorasNomes as any[] | null)?.find(
        (c) => c.nome && lower.includes(String(c.nome).toLowerCase()),
      );

      const detalhes: string[] = [];

      if (matchedObra) {
        const { data: obraFull } = await supa
          .from("obras")
          .select("*")
          .ilike("nome", matchedObra.nome)
          .maybeSingle();
        if (obraFull) {
          detalhes.push(`Obra "${matchedObra.nome}":`);
          for (const [k, v] of Object.entries(obraFull)) {
            if (v !== null && v !== "") detalhes.push(`  ${k}: ${v}`);
          }
        }
      }

      if (matchedConstrutora) {
        const { data: cFull } = await supa
          .from("construtoras")
          .select("*")
          .ilike("nome", matchedConstrutora.nome)
          .maybeSingle();
        if (cFull) {
          detalhes.push(`\nConstrutora "${matchedConstrutora.nome}":`);
          for (const [k, v] of Object.entries(cFull)) {
            if (v !== null && v !== "") detalhes.push(`  ${k}: ${v}`);
          }
        }
      }

      if (detalhes.length > 0) {
        parts.push("\n\nDETALHES DA OBRA/CONSTRUTORA MENCIONADA:");
        parts.push(...detalhes);
      }
    }
  } catch (e) {
    console.error("Erro detalhe sob demanda:", e);
  }

  // Memória de aprendizado
  try {
    const texto = (lastUserMsg || "").toLowerCase();

    // Sempre: globais de preferencia/correcao
    const { data: globais } = await supa
      .from("memoria_michele")
      .select("tipo, escopo, conteudo")
      .eq("ativo", true)
      .eq("escopo", "global")
      .in("tipo", ["preferencia", "correcao"])
      .order("created_at", { ascending: false })
      .limit(15);

    // Específicos por escopo mencionado
    let especificos: any[] = [];
    if (texto.length >= 3) {
      const { data: outros } = await supa
        .from("memoria_michele")
        .select("tipo, escopo, conteudo")
        .eq("ativo", true)
        .neq("escopo", "global")
        .order("created_at", { ascending: false });
      especificos = ((outros as any[]) ?? []).filter(
        (m) => m.escopo && texto.includes(String(m.escopo).toLowerCase()),
      );
    }

    const todos = [...((globais as any[]) ?? []), ...especificos].slice(0, 15);
    if (todos.length > 0) {
      parts.push("\n\nMEMÓRIA (o que aprendi com o Bruno):");
      for (const m of todos) {
        parts.push(`  - [${m.tipo} · ${m.escopo}] ${m.conteudo}`);
      }
    }
  } catch (e) {
    console.error("Erro carregando memória:", e);
  }

  return parts.join("\n");
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY não configurada." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json().catch(() => null);
    const messages = body?.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "Campo 'messages' é obrigatório." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // System prompt base
    let systemPrompt = DEFAULT_SYSTEM_PROMPT;
    try {
      const { data } = await supa
        .from("configuracoes")
        .select("valor")
        .eq("chave", "system_prompt_michele")
        .maybeSingle();
      if (data?.valor) systemPrompt = data.valor;
    } catch (e) {
      console.error("Erro lendo configuracoes:", e);
    }

    // Última mensagem do usuário para detecção de obra/construtora
    const lastUser = [...messages].reverse().find((m: any) => m.role === "user");
    const lastUserText =
      typeof lastUser?.content === "string"
        ? lastUser.content
        : Array.isArray(lastUser?.content)
          ? lastUser.content.map((c: any) => c.text ?? "").join(" ")
          : "";

    const contexto = await buildContext(supa, lastUserText);
    const systemEnriquecido = `${systemPrompt}\n\n---\n${contexto}`;

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 1500,
        system: systemEnriquecido,
        messages,
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error("Anthropic error:", anthropicRes.status, errText);
      return new Response(
        JSON.stringify({
          error: "A Michele teve um problema para responder. Tente novamente em instantes.",
          status: anthropicRes.status,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await anthropicRes.json();
    const text = data?.content?.[0]?.text ?? "";

    return new Response(JSON.stringify({ text }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("michele-chat error:", err);
    return new Response(
      JSON.stringify({ error: "Erro inesperado ao processar a mensagem." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
