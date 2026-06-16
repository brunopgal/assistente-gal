// Recebe uma planilha (xlsx/xls/csv) em base64, extrai linhas,
// pede à Claude para normalizar nos campos padrão de obra,
// roda busca tolerante por duplicatas e devolve um único cartão
// de aprovação em lote (tipo: cadastrar_obras_lote).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";
import * as XLSX from "npm:xlsx@0.18.5";

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

function b64ToBytes(b64: string): Uint8Array {
  const clean = b64.includes(",") ? b64.split(",")[1] : b64;
  const bin = atob(clean);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function parsePlanilha(bytes: Uint8Array, filename: string): Record<string, unknown>[] {
  const lower = filename.toLowerCase();
  const wb = XLSX.read(bytes, { type: "array", cellDates: true });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return [];
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false }) as Record<string, unknown>[];
  // Remove linhas totalmente vazias
  return rows.filter((r) =>
    Object.values(r).some((v) => v !== null && v !== undefined && String(v).trim() !== ""),
  );
}

async function normalizarComIA(linhas: Record<string, unknown>[]): Promise<any[]> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY não configurada");

  // Limita para evitar tokens excessivos
  const amostra = linhas.slice(0, 200);
  const headers = Array.from(
    new Set(amostra.flatMap((l) => Object.keys(l))),
  );

  const prompt = `Você recebe linhas de uma planilha de obras de construção. Cada linha é uma obra em potencial. As colunas variam.

Colunas encontradas: ${JSON.stringify(headers)}

Linhas (JSON):
${JSON.stringify(amostra)}

Devolva APENAS um array JSON válido, sem markdown, sem comentários. Cada item é uma obra normalizada nos campos padrão:
{
  "nome": string,                 // nome da obra (ou edifício/empreendimento)
  "construtora": string,          // nome da construtora (vazio se desconhecido)
  "cidade": string,
  "localizacao": string,          // endereço completo
  "responsavel": string,          // pessoa responsável/contato
  "telefone": string,
  "email": string,
  "produtoOferecido": string,     // ex: "Esquadrias", "Vidros" — vazio se desconhecido
  "estagioObra": string,          // ex: "Fundação", "Estrutura", "Acabamento" — vazio se desconhecido
  "observacoes": string           // qualquer info adicional relevante que não coube nos campos acima
}

Regras:
- Preserve nomes próprios em capitalização adequada (Title Case).
- Nunca invente dados. Se a coluna não existir, deixe string vazia.
- Junte na "observacoes" o que não couber nos campos padrão (ex: número de unidades, área, etc.).
- Ignore linhas claramente sem nome de obra.
- Devolva no MÁXIMO ${amostra.length} itens.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 8000,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Anthropic error ${res.status}: ${txt.slice(0, 300)}`);
  }
  const data = await res.json();
  const text = data?.content?.[0]?.text ?? "";
  const m = text.match(/\[[\s\S]*\]/);
  if (!m) return [];
  try {
    const arr = JSON.parse(m[0]);
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    console.error("Falha ao parsear JSON da IA:", e, text.slice(0, 500));
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims, error: authErr } = await userClient.auth.getClaims(
      authHeader.slice(7),
    );
    if (authErr || !claims?.claims) return json({ error: "Unauthorized" }, 401);

    const sb = createClient(SUPABASE_URL, SERVICE);

    const body = await req.json().catch(() => null);
    const base64 = body?.base64 as string | undefined;
    const filename = String(body?.filename ?? "planilha.xlsx");
    if (!base64) return json({ error: "Arquivo ausente" }, 400);

    const bytes = b64ToBytes(base64);
    const linhas = parsePlanilha(bytes, filename);
    if (linhas.length === 0) {
      return json({
        text: "Não consegui ler nenhuma linha válida nessa planilha. Confere se há cabeçalho e dados?",
      });
    }

    let normalizadas: any[] = [];
    try {
      normalizadas = await normalizarComIA(linhas);
    } catch (e) {
      console.error("normalizarComIA falhou:", e);
      return json({
        text: `Recebi a planilha (${linhas.length} linhas) mas não consegui organizar os dados agora: ${
          e instanceof Error ? e.message : String(e)
        }`,
      });
    }

    // Para cada obra normalizada, busca tolerante por possíveis duplicatas
    const novas: any[] = [];
    const duplicatas: { obra: any; candidatas: any[] }[] = [];

    for (const o of normalizadas) {
      const nome = String(o?.nome ?? "").trim();
      if (!nome) continue;
      const construtora = String(o?.construtora ?? "").trim();
      const termo = construtora ? `${nome} ${construtora}` : nome;
      const { data: matches } = await sb.rpc("buscar_obras_fuzzy", {
        termo,
        limite: 3,
      });
      const fortes = ((matches as any[]) ?? []).filter((m) => (m.score ?? 0) >= 0.55);
      if (fortes.length > 0) {
        duplicatas.push({ obra: o, candidatas: fortes });
      } else {
        novas.push(o);
      }
    }

    const linhasResumo: string[] = [];
    linhasResumo.push(`Recebi a planilha "${filename}" com ${linhas.length} linha(s).`);
    linhasResumo.push("");
    linhasResumo.push(`📊 Resumo:`);
    linhasResumo.push(`  • ${novas.length} obra(s) nova(s) prontas para cadastrar`);
    linhasResumo.push(`  • ${duplicatas.length} possível(is) duplicata(s) que precisam de revisão`);

    if (novas.length > 0) {
      linhasResumo.push("");
      linhasResumo.push(`🆕 Novas obras:`);
      for (const o of novas.slice(0, 30)) {
        linhasResumo.push(
          `  - ${o.nome}${o.construtora ? ` (${o.construtora})` : ""}${o.cidade ? ` · ${o.cidade}` : ""}`,
        );
      }
      if (novas.length > 30) linhasResumo.push(`  …e mais ${novas.length - 30}.`);
    }

    if (duplicatas.length > 0) {
      linhasResumo.push("");
      linhasResumo.push(`⚠️ Possíveis duplicatas (não vou cadastrar — me confirma uma a uma):`);
      for (const d of duplicatas.slice(0, 20)) {
        const cands = d.candidatas
          .map((c) => `${c.codigoObra} ${c.nome}${c.construtora ? ` (${c.construtora})` : ""}`)
          .join(" | ");
        linhasResumo.push(
          `  - "${d.obra.nome}"${d.obra.construtora ? ` (${d.obra.construtora})` : ""} → parecido com: ${cands}`,
        );
      }
      if (duplicatas.length > 20) linhasResumo.push(`  …e mais ${duplicatas.length - 20}.`);
    }

    let resposta = linhasResumo.join("\n");

    if (novas.length > 0) {
      const acaoBlock = `\n\n[ACAO]\ntipo: cadastrar_obras_lote\ndados: ${JSON.stringify({
        novas,
        duplicatas_resumo: duplicatas.map((d) => ({
          nome: d.obra.nome,
          construtora: d.obra.construtora,
          candidatas: d.candidatas.map((c) => ({
            codigoObra: c.codigoObra,
            nome: c.nome,
            construtora: c.construtora,
          })),
        })),
      })}\n[/ACAO]`;
      resposta += acaoBlock;
    }

    return json({ text: resposta, novas: novas.length, duplicatas: duplicatas.length });
  } catch (err) {
    console.error("michele-importar-planilha erro:", err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
