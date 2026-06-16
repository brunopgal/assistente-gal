import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TIPOS_OK = new Set([
  "cadastrar_construtora", "cadastrar_obra", "cadastrar_contato",
]);

const norm = (s: unknown) =>
  String(s ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

function normalizarProdutos(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  const partes = Array.isArray(v)
    ? v.flatMap((x) => String(x ?? "").split(/[,;|]| e | E |\+|\//))
    : String(v).split(/[,;|]| e | E |\+|\//);
  const canon: Record<string, string> = {
    prado: "Prado", rohden: "Rohden", rhoden: "Rohden", imab: "Imab",
  };
  const out: string[] = [];
  const seen = new Set<string>();
  for (const p of partes) {
    const k = p.trim().toLowerCase();
    if (!k) continue;
    const nome = canon[k] ?? p.trim();
    const key = nome.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(nome);
  }
  return out.length ? out.join(", ") : undefined;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function proximoSeq(sb: any, table: string, col: string, prefix: string, pad: number) {
  const { data } = await sb.from(table).select(col).ilike(col, `${prefix}%`)
    .order(col, { ascending: false }).limit(50);
  let max = 0;
  const re = new RegExp(`${prefix}0*(\\d+)`, "i");
  for (const r of (data as any[]) ?? []) {
    const m = re.exec(String(r[col] ?? ""));
    if (m) max = Math.max(max, Number(m[1]));
  }
  return { max, build: (n: number) => prefix + String(n).padStart(pad, "0") };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: claims, error: authErr } = await userClient.auth.getClaims(authHeader.slice(7));
  if (authErr || !claims?.claims) return json({ error: "Unauthorized" }, 401);

  const sb = createClient(SUPABASE_URL, SERVICE);

  let body: { acoes?: Array<{ tipo: string; dados: Record<string, unknown> }>; titulo?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "JSON inválido" }, 400);
  }

  const acoes = Array.isArray(body?.acoes) ? body.acoes : [];
  if (acoes.length === 0) return json({ error: "Nenhuma ação no plano" }, 400);

  // Seqs em memória
  const seqCT = await proximoSeq(sb, "construtoras", "codigo", "CT", 9);
  const seqObra = await proximoSeq(sb, "obras", "codigoObra", "OBRA", 9);
  const seqPE = await proximoSeq(sb, "pessoas", "codigoPessoa", "PE", 9);

  // Maps nome→codigo (para resolução intra-plano)
  const ctPorNome = new Map<string, string>();
  const obraPorNome = new Map<string, string>();

  const detalhes: Array<{
    tipo: string;
    nome: string;
    status: "criado" | "reaproveitado" | "erro";
    codigo?: string;
    mensagem?: string;
  }> = [];

  const construtorasCriadas: string[] = [];
  const obrasCriadas: string[] = [];
  const contatosCriados: string[] = [];
  const reaproveitados: string[] = [];

  // Ordenação por dependência: construtora → obra → contato
  const ordem = { cadastrar_construtora: 0, cadastrar_obra: 1, cadastrar_contato: 2 } as Record<string, number>;
  const fila = [...acoes].sort((a, b) => (ordem[a.tipo] ?? 9) - (ordem[b.tipo] ?? 9));

  const resolveCodigoConstrutora = async (d: Record<string, unknown>): Promise<string | null> => {
    const codigo = String(d.codigoConstrutora ?? "").trim();
    if (codigo) return codigo;
    const nome = String(d.construtora_nome ?? d.construtora ?? "").trim();
    if (!nome) return null;
    const cached = ctPorNome.get(norm(nome));
    if (cached) return cached;
    try {
      const { data: m } = await sb.rpc("buscar_construtoras_fuzzy", { termo: nome, limite: 1 });
      const top = ((m as any[]) ?? [])[0];
      if (top && (top.score ?? 0) >= 0.6) {
        ctPorNome.set(norm(nome), top.codigo);
        return top.codigo;
      }
    } catch { /* ignore */ }
    return null;
  };

  const resolveCodigoObra = async (d: Record<string, unknown>): Promise<string | null> => {
    const codigo = String(d.codigoObraAtual ?? d.codigoObra ?? "").trim();
    if (codigo) return codigo;
    const nome = String(d.obra_nome ?? d.obra ?? "").trim();
    if (!nome) return null;
    const cached = obraPorNome.get(norm(nome));
    if (cached) return cached;
    try {
      const { data: m } = await sb.rpc("buscar_obras_fuzzy", { termo: nome, limite: 1 });
      const top = ((m as any[]) ?? [])[0];
      if (top && (top.score ?? 0) >= 0.7) {
        obraPorNome.set(norm(nome), top.codigoObra);
        return top.codigoObra;
      }
    } catch { /* ignore */ }
    return null;
  };

  const hoje = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

  for (const acao of fila) {
    const tipo = String(acao?.tipo ?? "");
    const d = (acao?.dados ?? {}) as Record<string, unknown>;
    const nome = String(d.nome ?? "").trim();

    if (!TIPOS_OK.has(tipo)) {
      detalhes.push({ tipo, nome, status: "erro", mensagem: `Tipo não suportado no plano: ${tipo}` });
      continue;
    }
    if (!nome) {
      detalhes.push({ tipo, nome: "(sem nome)", status: "erro", mensagem: "nome é obrigatório" });
      continue;
    }

    try {
      if (tipo === "cadastrar_construtora") {
        // duplicata
        const { data: m } = await sb.rpc("buscar_construtoras_fuzzy", { termo: nome, limite: 1 });
        const top = ((m as any[]) ?? [])[0];
        if (top && (top.score ?? 0) >= 0.7) {
          ctPorNome.set(norm(nome), top.codigo);
          detalhes.push({ tipo, nome, status: "reaproveitado", codigo: top.codigo, mensagem: `já existe (${top.nome})` });
          reaproveitados.push(`Construtora ${nome} → ${top.codigo}`);
          continue;
        }
        seqCT.max += 1;
        const codigo = seqCT.build(seqCT.max);
        const insert: Record<string, unknown> = { codigo, nome, status: "Prospecção" };
        const prod = normalizarProdutos(d.produto);
        if (prod) insert.produto = prod;
        for (const k of ["cnpj", "observacoes"]) {
          const v = d[k];
          if (v !== undefined && v !== null && String(v).trim() !== "") insert[k] = v;
        }
        const { error } = await sb.from("construtoras").insert(insert);
        if (error) {
          seqCT.max -= 1;
          detalhes.push({ tipo, nome, status: "erro", mensagem: error.message });
          await sb.from("log_automacao").insert({
            tipo_acao: tipo, descricao: `Falha: ${nome}`, sucesso: false,
            mensagem_erro: error.message, dados_json: d, criado_por: "michele",
          });
          continue;
        }
        ctPorNome.set(norm(nome), codigo);
        construtorasCriadas.push(`${nome} (${codigo})`);
        detalhes.push({ tipo, nome, status: "criado", codigo });
        await sb.from("log_automacao").insert({
          tipo_acao: tipo, descricao: `Construtora (lote): ${nome} (${codigo})`,
          sucesso: true, dados_json: d, criado_por: "michele",
        });
      } else if (tipo === "cadastrar_obra") {
        // duplicata
        const { data: m } = await sb.rpc("buscar_obras_fuzzy", { termo: nome, limite: 1 });
        const top = ((m as any[]) ?? [])[0];
        if (top && (top.score ?? 0) >= 0.8) {
          obraPorNome.set(norm(nome), top.codigoObra);
          detalhes.push({ tipo, nome, status: "reaproveitado", codigo: top.codigoObra, mensagem: `já existe (${top.nome})` });
          reaproveitados.push(`Obra ${nome} → ${top.codigoObra}`);
          continue;
        }
        const codigoConstrutora = await resolveCodigoConstrutora(d);
        seqObra.max += 1;
        const codigo = seqObra.build(seqObra.max);
        const insert: Record<string, unknown> = {
          codigoObra: codigo, gerenciada_michele: true, dataCadastro: hoje, nome,
        };
        const cNome = String(d.construtora_nome ?? d.construtora ?? "").trim();
        if (cNome) insert.construtora = cNome;
        if (codigoConstrutora) insert.codigoConstrutora = codigoConstrutora;
        for (const k of ["cidade", "localizacao", "responsavel", "telefone", "email",
          "estagioObra", "observacoes", "statusProspeccao", "fase_michele"]) {
          const v = d[k];
          if (v !== undefined && v !== null && String(v).trim() !== "") insert[k] = v;
        }
        const prod = normalizarProdutos(d.produtoOferecido);
        if (prod) insert.produtoOferecido = prod;
        const { error } = await sb.from("obras").insert(insert);
        if (error) {
          seqObra.max -= 1;
          detalhes.push({ tipo, nome, status: "erro", mensagem: error.message });
          await sb.from("log_automacao").insert({
            tipo_acao: tipo, descricao: `Falha: ${nome}`, sucesso: false,
            mensagem_erro: error.message, dados_json: d, criado_por: "michele",
          });
          continue;
        }
        obraPorNome.set(norm(nome), codigo);
        obrasCriadas.push(`${nome} (${codigo})`);
        detalhes.push({ tipo, nome, status: "criado", codigo });
        await sb.from("log_automacao").insert({
          codigoObra: codigo, tipo_acao: tipo,
          descricao: `Obra (lote): ${nome} (${codigo})`,
          sucesso: true, dados_json: d, criado_por: "michele",
        });
      } else if (tipo === "cadastrar_contato") {
        // duplicata
        const { data: m } = await sb.rpc("buscar_pessoas_fuzzy", { termo: nome, limite: 1 });
        const top = ((m as any[]) ?? [])[0];
        if (top && (top.score ?? 0) >= 0.85) {
          detalhes.push({ tipo, nome, status: "reaproveitado", codigo: top.codigoPessoa, mensagem: `já existe (${top.nome})` });
          reaproveitados.push(`Contato ${nome} → ${top.codigoPessoa}`);
          continue;
        }
        const codigoConstrutora = await resolveCodigoConstrutora(d);
        const codigoObraAtual = await resolveCodigoObra(d);
        seqPE.max += 1;
        const codigo = seqPE.build(seqPE.max);
        const insert: Record<string, unknown> = {
          codigoPessoa: codigo, nome,
          cargo: String(d.cargo ?? "").trim() || "Não Informado",
          dataCadastro: hoje, dataUltimaAtualizacao: hoje,
        };
        if (codigoConstrutora) insert.codigoConstrutora = codigoConstrutora;
        if (codigoObraAtual) insert.codigoObraAtual = codigoObraAtual;
        for (const k of ["whatsapp", "email", "observacoes", "canal_preferido", "melhor_horario"]) {
          const v = d[k];
          if (v !== undefined && v !== null && String(v).trim() !== "") insert[k] = v;
        }
        const { error } = await sb.from("pessoas").insert(insert);
        if (error) {
          seqPE.max -= 1;
          detalhes.push({ tipo, nome, status: "erro", mensagem: error.message });
          await sb.from("log_automacao").insert({
            tipo_acao: tipo, descricao: `Falha: ${nome}`, sucesso: false,
            mensagem_erro: error.message, dados_json: d, criado_por: "michele",
          });
          continue;
        }
        contatosCriados.push(`${nome} (${codigo})`);
        detalhes.push({ tipo, nome, status: "criado", codigo });
        await sb.from("log_automacao").insert({
          tipo_acao: tipo, descricao: `Contato (lote): ${nome} (${codigo})`,
          sucesso: true, dados_json: d, criado_por: "michele",
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      detalhes.push({ tipo, nome, status: "erro", mensagem: msg });
    }
  }

  const erros = detalhes.filter((x) => x.status === "erro");

  const partes = [
    construtorasCriadas.length ? `${construtorasCriadas.length} construtora(s) nova(s)` : null,
    obrasCriadas.length ? `${obrasCriadas.length} obra(s) nova(s)` : null,
    contatosCriados.length ? `${contatosCriados.length} contato(s) novo(s)` : null,
    reaproveitados.length ? `${reaproveitados.length} reaproveitado(s)` : null,
    erros.length ? `${erros.length} erro(s)` : null,
  ].filter(Boolean).join(" · ");

  await sb.from("log_automacao").insert({
    tipo_acao: "executar_lote",
    descricao: `Plano: ${body.titulo ?? partes}`,
    sucesso: erros.length === 0,
    mensagem_erro: erros.length ? erros.slice(0, 10).map((e) => `${e.tipo}/${e.nome}: ${e.mensagem}`).join(" | ") : null,
    dados_json: { titulo: body.titulo, detalhes },
    criado_por: "michele",
  });

  return json({
    ok: erros.length === 0,
    resumo: `Plano executado: ${partes || "nada a fazer"}.`,
    detalhes,
    construtoras_criadas: construtorasCriadas,
    obras_criadas: obrasCriadas,
    contatos_criados: contatosCriados,
    reaproveitados,
    erros: erros.map((e) => `${e.tipo}/${e.nome}: ${e.mensagem}`),
  });
});
