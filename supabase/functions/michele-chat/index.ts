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

  // DATA DE HOJE (fuso São Paulo)
  const hojeFmt = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date());
  parts.push(
    `DATA DE HOJE: ${hojeFmt} (fuso America/Sao_Paulo). ` +
      "Use sempre esta data como referência para calcular prazos e follow-ups. " +
      "Nunca use datas de cadastro das obras como referência para 'hoje'.",
  );
  parts.push("");
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

  // Busca tolerante (parcial sem acento/caixa + fuzzy por similaridade) de
  // pessoas, construtoras e obras parecidas ao que o Bruno mencionou.
  try {
    const stop = new Set([
      "obra","construtora","cidade","nova","novo","favor","cadastrar","cadastra","cadastro",
      "registrar","incluir","adicionar","quero","gostaria","poderia","preciso","essa","esse",
      "para","esta","este","fica","local","localizada","endereco","aqui","tenho","foto","placa",
      "print","mostra","com","sem","mais","menos","muito","pouco","talvez","sobre","pessoa",
      "contato","fala","conhece","sabe","quem","qual","quais","onde","como","tudo","ola",
      "oi","bom","dia","tarde","noite","alguma","alguem","tem","tinha","aquele","aquela",
      "criar","criou","criada","criado","nome","empresa","cliente","fornecedor",
    ]);

    const raw = (lastUserMsg || "").trim();
    const candidatos = new Set<string>();

    // Frases com iniciais maiúsculas (prováveis nomes próprios)
    const frasesProprias = raw.match(
      /\b[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ][\wÁÀÂÃÉÊÍÓÔÕÚÇáàâãéêíóôõúç]+(?:\s+(?:de|da|do|das|dos|e|[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ][\wÁÀÂÃÉÊÍÓÔÕÚÇáàâãéêíóôõúç]+))*/g,
    ) || [];
    for (const f of frasesProprias) {
      const limpo = f.trim();
      if (limpo.length >= 3) candidatos.add(limpo);
    }

    // Tokens longos não-stopword (cobre erros de digitação e nomes únicos)
    const tokens = raw
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 4 && !stop.has(t));
    for (const t of tokens.slice(0, 6)) candidatos.add(t);

    const termos = Array.from(candidatos).slice(0, 8);

    if (termos.length > 0) {
      const pessoas = new Map<string, any>();
      const construtoras = new Map<string, any>();
      const obras = new Map<string, any>();

      await Promise.all(termos.flatMap((termo) => [
        supa.rpc("buscar_pessoas_fuzzy", { termo, limite: 5 }).then(({ data }: any) => {
          for (const r of (data ?? [])) {
            const prev = pessoas.get(r.codigoPessoa);
            if (!prev || (r.score ?? 0) > (prev.score ?? 0)) pessoas.set(r.codigoPessoa, r);
          }
        }).catch((e) => console.error("rpc pessoas:", e)),
        supa.rpc("buscar_construtoras_fuzzy", { termo, limite: 5 }).then(({ data }: any) => {
          for (const r of (data ?? [])) {
            const prev = construtoras.get(r.codigo);
            if (!prev || (r.score ?? 0) > (prev.score ?? 0)) construtoras.set(r.codigo, r);
          }
        }).catch((e) => console.error("rpc construtoras:", e)),
        supa.rpc("buscar_obras_fuzzy", { termo, limite: 5 }).then(({ data }: any) => {
          for (const r of (data ?? [])) {
            const prev = obras.get(r.codigoObra);
            if (!prev || (r.score ?? 0) > (prev.score ?? 0)) obras.set(r.codigoObra, r);
          }
        }).catch((e) => console.error("rpc obras:", e)),
      ]));

      const topPessoas = [...pessoas.values()].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 5);
      const topConstrutoras = [...construtoras.values()].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 5);
      const topObras = [...obras.values()].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 5);

      if (topPessoas.length > 0) {
        parts.push("\n\nPESSOAS PARECIDAS JÁ CADASTRADAS (verifique antes de criar):");
        for (const p of topPessoas) {
          parts.push(
            `  - ${p.codigoPessoa} · ${p.nome ?? "-"} | cargo ${p.cargo ?? "-"} | wpp ${p.whatsapp ?? "-"} | construtora ${p.codigoConstrutora ?? "-"} | obra ${p.codigoObraAtual ?? "-"}${p.observacoes ? ` | obs: ${String(p.observacoes).slice(0,120)}` : ""}`,
          );
        }
      }
      if (topConstrutoras.length > 0) {
        parts.push("\n\nCONSTRUTORAS PARECIDAS JÁ CADASTRADAS (verifique antes de criar):");
        for (const c of topConstrutoras) {
          parts.push(
            `  - ${c.codigo} · ${c.nome ?? "-"} | cnpj ${c.cnpj ?? "-"} | status ${c.status ?? "-"}${c.observacoes ? ` | obs: ${String(c.observacoes).slice(0,120)}` : ""}`,
          );
        }
      }
      if (topObras.length > 0) {
        parts.push("\n\nOBRAS PARECIDAS JÁ CADASTRADAS (verifique antes de criar):");
        for (const o of topObras) {
          parts.push(
            `  - ${o.codigoObra} · ${o.nome ?? "-"} | ${o.construtora ?? "-"} | ${o.cidade ?? "-"} | fase ${o.fase_michele ?? "-"} | resp ${o.responsavel ?? "-"}${o.observacoes ? ` | obs: ${String(o.observacoes).slice(0,120)}` : ""}`,
          );
        }
      }
    }
  } catch (e) {
    console.error("Erro buscando parecidos (fuzzy):", e);
  }

  return parts.join("\n");
}

type ImageBlock = {
  type: "image";
  source: { type: "base64"; media_type: string; data: string };
};
type TextBlock = { type: "text"; text: string };
type AnthropicContent = string | Array<TextBlock | ImageBlock>;
type AnthropicMessage = { role: "user" | "assistant"; content: AnthropicContent };

function normalizeMessageContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part: any) => {
        if (typeof part === "string") return part;
        if (typeof part?.text === "string") return part.text;
        if (typeof part?.content === "string") return part.content;
        return "";
      })
      .join(" ")
      .trim();
  }
  return "";
}

function sanitizeAnthropicMessages(messages: unknown[]): AnthropicMessage[] {
  return messages
    .map((m: any) => ({
      role: (m?.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
      content: normalizeMessageContent(m?.content),
    }))
    .filter((m) => typeof m.content === "string" && m.content.length > 0);
}

function parseDataUrl(dataUrl: string): { media_type: string; data: string } | null {
  const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl.trim());
  if (!m) return null;
  const media_type = m[1];
  if (!/^image\/(jpeg|png|gif|webp)$/.test(media_type)) return null;
  return { media_type, data: m[2] };
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
    const anthropicMessages = sanitizeAnthropicMessages(messages as unknown[]);

    // Imagem opcional: anexa como bloco na última mensagem do usuário
    const imageDataUrl = typeof body?.image === "string" ? body.image : null;
    if (imageDataUrl && anthropicMessages.length > 0) {
      const parsed = parseDataUrl(imageDataUrl);
      if (parsed) {
        for (let i = anthropicMessages.length - 1; i >= 0; i--) {
          if (anthropicMessages[i].role === "user") {
            const txt = typeof anthropicMessages[i].content === "string"
              ? (anthropicMessages[i].content as string)
              : "";
            anthropicMessages[i] = {
              role: "user",
              content: [
                { type: "image", source: { type: "base64", media_type: parsed.media_type, data: parsed.data } },
                { type: "text", text: txt || "Analise a imagem anexa." },
              ],
            };
            break;
          }
        }
      }
    }

    // Documento opcional: PDF como bloco "document"; .txt/.md/.docx como texto inline
    const documento = body?.documento as { name?: string; base64?: string; mime?: string } | undefined;
    if (documento?.base64 && anthropicMessages.length > 0) {
      const nameLower = (documento.name ?? "").toLowerCase();
      const mime = documento.mime ?? "";
      const isPdf = mime === "application/pdf" || nameLower.endsWith(".pdf");
      const isTxt = mime.startsWith("text/") || nameLower.endsWith(".txt") || nameLower.endsWith(".md");
      const isDocx = nameLower.endsWith(".docx") ||
        mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

      let docBlock: any = null;
      let inlineText: string | null = null;

      try {
        if (isPdf) {
          docBlock = {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: documento.base64 },
          };
        } else if (isTxt) {
          const bin = atob(documento.base64);
          const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          const text = new TextDecoder("utf-8").decode(bytes).slice(0, 200_000);
          inlineText = `\n\n--- conteúdo do documento "${documento.name}" ---\n${text}\n--- fim do documento ---`;
        } else if (isDocx) {
          const mammoth = await import("https://esm.sh/mammoth@1.8.0?target=deno");
          const bin = atob(documento.base64);
          const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          const result = await (mammoth as any).extractRawText({ arrayBuffer: bytes.buffer });
          const text = String(result?.value ?? "").slice(0, 200_000);
          inlineText = `\n\n--- conteúdo do documento "${documento.name}" ---\n${text}\n--- fim do documento ---`;
        } else {
          inlineText = `\n\n[documento "${documento.name}" anexo — formato não suportado para leitura automática]`;
        }
      } catch (e) {
        console.error("Erro processando documento:", e);
        inlineText = `\n\n[falha ao ler o documento "${documento.name}"]`;
      }

      for (let i = anthropicMessages.length - 1; i >= 0; i--) {
        if (anthropicMessages[i].role === "user") {
          const prev = anthropicMessages[i].content;
          const prevText = typeof prev === "string" ? prev : "";
          const baseText = (prevText || `Analise o documento "${documento.name}".`) + (inlineText ?? "");
          if (docBlock) {
            const blocks: any[] = Array.isArray(prev) ? [...prev] : [];
            blocks.push(docBlock);
            blocks.push({ type: "text", text: baseText });
            anthropicMessages[i] = { role: "user", content: blocks as any };
          } else {
            anthropicMessages[i] = { role: "user", content: baseText };
          }
          break;
        }
      }
    }


    if (anthropicMessages.length === 0) {
      return new Response(
        JSON.stringify({ error: "Nenhuma mensagem válida para enviar à Michele." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }


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
        messages: anthropicMessages,
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
