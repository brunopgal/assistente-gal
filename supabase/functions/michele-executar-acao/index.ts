import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED = new Set([
  "criar_followup", "mudar_fase", "atualizar_obra", "cadastrar_obra",
  "cadastrar_construtora", "cadastrar_contato", "atualizar_contato",
  "cadastrar_obras_lote",
]);

const OBRA_FIELDS = new Set([
  "statusProspeccao", "nome", "classificacao", "construtora", "codigoConstrutora",
  "responsavel", "telefone", "email", "cidade", "localizacao", "produtoOferecido", "estagioObra",
  "marcouReuniao", "visita", "dataUltimaVisita", "dataOrcamentoEnviado",
  "proximoContato", "observacoes", "concorrentes", "prospeccaoIA",
  "fase_michele", "temperatura", "numero_tentativa", "data_proxima_acao",
  "potencial", "gerenciada_michele",
]);

const CONSTRUTORA_FIELDS = new Set(["nome", "cnpj", "produto", "status", "observacoes", "prospeccaoIA"]);
const PESSOA_FIELDS = new Set([
  "codigoConstrutora", "codigoObraAtual", "nome", "cargo", "whatsapp", "email",
  "observacoes", "canal_preferido", "melhor_horario",
]);

// Normaliza valores multi-produto: aceita string "Rohden, Imab", "Rohden e Imab",
// arrays ["Rohden","Imab"], ou repetições. Retorna "Rohden, Imab" preservando ordem
// e capitalização canônica (Prado, Rohden, Imab). Nunca descarta produtos.
function normalizarProdutos(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  let partes: string[] = [];
  if (Array.isArray(v)) {
    partes = v.flatMap((x) => String(x ?? "").split(/[,;|]| e | E |\+|\//));
  } else {
    partes = String(v).split(/[,;|]| e | E |\+|\//);
  }
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

async function proximoCodigo(sb: any, table: string, col: string, prefix: string, pad: number): Promise<string> {
  const { data } = await sb.from(table).select(col).ilike(col, `${prefix}%`).order(col, { ascending: false }).limit(50);
  let max = 0;
  const re = new RegExp(`${prefix}0*(\\d+)`, "i");
  for (const r of (data as any[]) ?? []) {
    const m = re.exec(String(r[col] ?? ""));
    if (m) max = Math.max(max, Number(m[1]));
  }
  return prefix + String(max + 1).padStart(pad, "0");
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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
  const { data: claims, error: authErr } = await userClient.auth.getClaims(
    authHeader.slice(7),
  );
  if (authErr || !claims?.claims) return json({ error: "Unauthorized" }, 401);

  const sb = createClient(SUPABASE_URL, SERVICE);

  let body: { tipo?: string; dados?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return json({ error: "JSON inválido" }, 400);
  }
  const tipo = String(body?.tipo ?? "");
  const dados = (body?.dados ?? {}) as Record<string, unknown>;

  // Aceitar aliases comuns vindos do modelo
  const aliases: Record<string, string> = {
    obra_id: "codigoObra",
    codigo_obra: "codigoObra",
    obraId: "codigoObra",
    codigo: "codigoObra",
    data_followup: "data_prevista",
    data: "data_prevista",
    dataPrevista: "data_prevista",
    canal: "canal_sugerido",
    fase: "fase_michele",
  };
  for (const [from, to] of Object.entries(aliases)) {
    if (dados[from] !== undefined && dados[to] === undefined) {
      dados[to] = dados[from];
      delete dados[from];
    }
  }


  if (!ALLOWED.has(tipo)) {
    return json({ error: `Ação "${tipo}" ainda não disponível.` }, 400);
  }

  // cadastrar_obras_lote: cadastra várias obras de uma vez,
  // criando construtoras que não existem por nome (fuzzy).
  if (tipo === "cadastrar_obras_lote") {
    const novas = Array.isArray((dados as any).novas) ? (dados as any).novas : [];
    if (novas.length === 0) return json({ error: "Nenhuma obra para cadastrar" }, 400);

    // Próximo OBRA000000000
    const { data: ultObras } = await sb
      .from("obras").select("codigoObra")
      .ilike("codigoObra", "OBRA%")
      .order("codigoObra", { ascending: false }).limit(50);
    let maxObra = 0;
    for (const r of (ultObras as any[]) ?? []) {
      const m = /OBRA0*(\d+)/i.exec(String(r.codigoObra ?? ""));
      if (m) maxObra = Math.max(maxObra, Number(m[1]));
    }

    // Próximo CT
    const { data: ultCT } = await sb
      .from("construtoras").select("codigo")
      .ilike("codigo", "CT%")
      .order("codigo", { ascending: false }).limit(50);
    let maxCT = 0;
    for (const r of (ultCT as any[]) ?? []) {
      const m = /CT0*(\d+)/i.exec(String(r.codigo ?? ""));
      if (m) maxCT = Math.max(maxCT, Number(m[1]));
    }

    const hoje = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const cacheCT = new Map<string, string>(); // nomeNormalizado -> codigo
    const obrasInseridas: { codigoObra: string; nome: string }[] = [];
    const construtorasCriadas: { codigo: string; nome: string }[] = [];
    const erros: string[] = [];

    for (const item of novas) {
      try {
        const nome = String(item?.nome ?? "").trim();
        if (!nome) continue;

        let codigoConstrutora: string | null = null;
        const cNome = String(item?.construtora ?? "").trim();
        if (cNome) {
          const key = cNome.toLowerCase();
          if (cacheCT.has(key)) {
            codigoConstrutora = cacheCT.get(key)!;
          } else {
            // fuzzy
            const { data: matches } = await sb.rpc("buscar_construtoras_fuzzy", {
              termo: cNome, limite: 1,
            });
            const top = ((matches as any[]) ?? [])[0];
            if (top && (top.score ?? 0) >= 0.6) {
              codigoConstrutora = top.codigo;
            } else {
              maxCT += 1;
              const novoCT = "CT" + String(maxCT).padStart(9, "0");
              const { error: ctErr } = await sb.from("construtoras").insert({
                codigo: novoCT, nome: cNome, status: "Prospecção",
              });
              if (ctErr) {
                erros.push(`construtora "${cNome}": ${ctErr.message}`);
                maxCT -= 1;
              } else {
                codigoConstrutora = novoCT;
                construtorasCriadas.push({ codigo: novoCT, nome: cNome });
              }
            }
            if (codigoConstrutora) cacheCT.set(key, codigoConstrutora);
          }
        }

        maxObra += 1;
        const novoCodigo = "OBRA" + String(maxObra).padStart(9, "0");
        const insert: Record<string, unknown> = {
          codigoObra: novoCodigo,
          gerenciada_michele: true,
          dataCadastro: hoje,
          nome,
        };
        if (cNome) insert.construtora = cNome;
        if (codigoConstrutora) insert.codigoConstrutora = codigoConstrutora;
        for (const k of ["cidade", "localizacao", "responsavel", "telefone", "email", "produtoOferecido", "estagioObra", "observacoes"]) {
          const v = (item as any)[k];
          if (v === undefined || v === null) continue;
          if (k === "produtoOferecido") {
            const n = normalizarProdutos(v);
            if (n) insert[k] = n;
          } else if (String(v).trim() !== "") {
            insert[k] = v;
          }
        }

        const { error: insErr } = await sb.from("obras").insert(insert);
        if (insErr) {
          erros.push(`obra "${nome}": ${insErr.message}`);
          maxObra -= 1;
        } else {
          obrasInseridas.push({ codigoObra: novoCodigo, nome });
          await sb.from("log_automacao").insert({
            codigoObra: novoCodigo, tipo_acao: "cadastrar_obra",
            descricao: `Obra cadastrada via planilha: ${nome}`,
            sucesso: true, dados_json: item, criado_por: "michele",
          });
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        erros.push(msg);
      }
    }

    await sb.from("log_automacao").insert({
      tipo_acao: "cadastrar_obras_lote",
      descricao: `Lote: ${obrasInseridas.length} obra(s) cadastrada(s), ${construtorasCriadas.length} construtora(s) criada(s)${erros.length ? `, ${erros.length} erro(s)` : ""}`,
      sucesso: erros.length === 0,
      mensagem_erro: erros.length ? erros.slice(0, 10).join(" | ") : null,
      dados_json: { obras: obrasInseridas, construtoras: construtorasCriadas, erros },
      criado_por: "michele",
    });

    const partes = [
      `${obrasInseridas.length} obra(s) cadastrada(s)`,
      construtorasCriadas.length > 0 ? `${construtorasCriadas.length} construtora(s) nova(s)` : null,
      erros.length > 0 ? `${erros.length} erro(s)` : null,
    ].filter(Boolean).join(" · ");

    return json({
      ok: erros.length === 0,
      resumo: `Lote processado: ${partes}.`,
      error: erros.length > 0 ? erros.slice(0, 5).join(" | ") : undefined,
      obras: obrasInseridas,
      construtoras: construtorasCriadas,
    });
  }

  // cadastrar_obra: gera novo codigoObra e insere
  if (tipo === "cadastrar_obra") {
    const nome = String(dados.nome ?? "").trim();
    if (!nome) return json({ error: "nome é obrigatório" }, 400);

    // Encontra maior número existente
    const { data: ultimas } = await sb
      .from("obras")
      .select("codigoObra")
      .ilike("codigoObra", "OBRA%")
      .order("codigoObra", { ascending: false })
      .limit(50);
    let max = 0;
    for (const r of (ultimas as any[]) ?? []) {
      const m = /OBRA0*(\d+)/i.exec(String(r.codigoObra ?? ""));
      if (m) max = Math.max(max, Number(m[1]));
    }
    const novoCodigo = "OBRA" + String(max + 1).padStart(9, "0");

    const insert: Record<string, unknown> = { codigoObra: novoCodigo, gerenciada_michele: true };
    for (const [k, v] of Object.entries(dados)) {
      if (k === "codigoObra") continue;
      if (!OBRA_FIELDS.has(k)) continue;
      if (v === undefined || v === null) continue;
      if (k === "produtoOferecido") {
        const n = normalizarProdutos(v);
        if (n) insert[k] = n;
      } else if (String(v).trim() !== "") {
        insert[k] = v;
      }
    }
    insert.dataCadastro = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

    const { data: inserida, error: insErr } = await sb
      .from("obras")
      .insert(insert)
      .select("codigoObra,nome")
      .single();
    if (insErr) {
      await sb.from("log_automacao").insert({
        codigoObra: novoCodigo, tipo_acao: tipo, descricao: "Falha ao cadastrar obra",
        sucesso: false, mensagem_erro: insErr.message, dados_json: dados, criado_por: "michele",
      });
      return json({ error: insErr.message }, 500);
    }
    await sb.from("log_automacao").insert({
      codigoObra: novoCodigo, tipo_acao: tipo, descricao: `Obra cadastrada: ${nome}`,
      sucesso: true, dados_json: dados, criado_por: "michele",
    });
    return json({
      ok: true,
      resumo: `Obra "${nome}" cadastrada como ${novoCodigo}.`,
      registro: inserida,
    });
  }

  if (tipo === "cadastrar_construtora") {
    const nome = String(dados.nome ?? "").trim();
    if (!nome) return json({ error: "nome é obrigatório" }, 400);
    const novoCodigo = await proximoCodigo(sb, "construtoras", "codigo", "CT", 9);
    const insert: Record<string, unknown> = { codigo: novoCodigo };
    for (const [k, v] of Object.entries(dados)) {
      if (!CONSTRUTORA_FIELDS.has(k)) continue;
      if (v === undefined || v === null) continue;
      if (k === "produto") {
        const n = normalizarProdutos(v);
        if (n) insert[k] = n;
      } else if (String(v).trim() !== "") {
        insert[k] = v;
      }
    }
    if (!insert.status) insert.status = "Prospecção";
    const { data: ins, error } = await sb.from("construtoras").insert(insert).select("codigo,nome").single();
    if (error) {
      await sb.from("log_automacao").insert({ tipo_acao: tipo, descricao: "Falha ao cadastrar construtora", sucesso: false, mensagem_erro: error.message, dados_json: dados, criado_por: "michele" });
      return json({ error: error.message }, 500);
    }
    await sb.from("log_automacao").insert({ tipo_acao: tipo, descricao: `Construtora cadastrada: ${nome} (${novoCodigo})`, sucesso: true, dados_json: dados, criado_por: "michele" });
    return json({ ok: true, resumo: `Construtora "${nome}" cadastrada como ${novoCodigo}.`, registro: ins, codigo: novoCodigo });
  }

  if (tipo === "cadastrar_contato") {
    const nome = String(dados.nome ?? "").trim();
    if (!nome) return json({ error: "nome é obrigatório" }, 400);
    const novoCodigo = await proximoCodigo(sb, "pessoas", "codigoPessoa", "PE", 9);
    const insert: Record<string, unknown> = { codigoPessoa: novoCodigo };
    for (const [k, v] of Object.entries(dados)) {
      if (PESSOA_FIELDS.has(k) && v !== undefined && v !== null && String(v).trim() !== "") insert[k] = v;
    }
    if (!insert.cargo) insert.cargo = "Não Informado";
    const hoje = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
    insert.dataCadastro = hoje;
    insert.dataUltimaAtualizacao = hoje;
    const { data: ins, error } = await sb.from("pessoas").insert(insert).select("codigoPessoa,nome").single();
    if (error) {
      await sb.from("log_automacao").insert({ tipo_acao: tipo, descricao: "Falha ao cadastrar contato", sucesso: false, mensagem_erro: error.message, dados_json: dados, criado_por: "michele" });
      return json({ error: error.message }, 500);
    }
    await sb.from("log_automacao").insert({ tipo_acao: tipo, descricao: `Contato cadastrado: ${nome} (${novoCodigo})`, sucesso: true, dados_json: dados, criado_por: "michele" });
    return json({ ok: true, resumo: `Contato "${nome}" cadastrado como ${novoCodigo}.`, registro: ins, codigoPessoa: novoCodigo });
  }

  if (tipo === "atualizar_contato") {
    const codigoPessoa = String(dados.codigoPessoa ?? "").trim();
    if (!codigoPessoa) return json({ error: "codigoPessoa é obrigatório" }, 400);
    const { data: existente, error: getErr } = await sb.from("pessoas").select("codigoPessoa,nome,observacoes").eq("codigoPessoa", codigoPessoa).maybeSingle();
    if (getErr) return json({ error: getErr.message }, 500);
    if (!existente) return json({ error: `Contato ${codigoPessoa} não encontrado` }, 404);

    const update: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(dados)) {
      if (k === "codigoPessoa" || k === "observacoes") continue;
      if (PESSOA_FIELDS.has(k) && v !== undefined && v !== null && String(v).trim() !== "") update[k] = v;
    }
    const novaObs = dados.observacoes !== undefined && dados.observacoes !== null ? String(dados.observacoes).trim() : "";
    if (novaObs) {
      const atual = String((existente as any).observacoes ?? "").trim();
      update.observacoes = atual ? `${atual}\n${novaObs}` : novaObs;
    }
    if (Object.keys(update).length === 0) return json({ error: "Nenhum campo para atualizar" }, 400);
    update.dataUltimaAtualizacao = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const { error } = await sb.from("pessoas").update(update).eq("codigoPessoa", codigoPessoa);
    if (error) {
      await sb.from("log_automacao").insert({ tipo_acao: tipo, descricao: "Falha ao atualizar contato", sucesso: false, mensagem_erro: error.message, dados_json: dados, criado_por: "michele" });
      return json({ error: error.message }, 500);
    }
    const campos = Object.keys(update).join(", ");
    await sb.from("log_automacao").insert({ tipo_acao: tipo, descricao: `Contato ${codigoPessoa} atualizado (${campos})`, sucesso: true, dados_json: dados, criado_por: "michele" });
    return json({ ok: true, resumo: `Contato ${(existente as any).nome || codigoPessoa} atualizado (${campos}).` });
  }

  const codigoObra = String(dados.codigoObra ?? "").trim();
  if (!codigoObra) return json({ error: "codigoObra é obrigatório" }, 400);


  const { data: obra, error: obraErr } = await sb
    .from("obras")
    .select("codigoObra,nome,fase_michele,temperatura")
    .eq("codigoObra", codigoObra)
    .maybeSingle();
  if (obraErr) return json({ error: obraErr.message }, 500);
  if (!obra) return json({ error: `Obra ${codigoObra} não encontrada` }, 404);

  async function log(sucesso: boolean, descricao: string, erro?: string) {
    await sb.from("log_automacao").insert({
      codigoObra,
      tipo_acao: tipo,
      descricao,
      sucesso,
      mensagem_erro: erro ?? null,
      dados_json: dados,
      criado_por: "michele",
    });
  }

  try {
    if (tipo === "criar_followup") {
      const payload = {
        codigoObra,
        descricao: String(dados.descricao ?? "").trim(),
        tipo: dados.tipo ? String(dados.tipo) : null,
        data_prevista: String(dados.data_prevista ?? ""),
        canal_sugerido: dados.canal_sugerido ? String(dados.canal_sugerido) : null,
        prioridade: dados.prioridade ? String(dados.prioridade) : "normal",
        responsavel: dados.responsavel ? String(dados.responsavel) : "michele",
      };
      if (!payload.descricao || !payload.data_prevista) {
        await log(false, "Follow-up sem descrição ou data", "campos obrigatórios faltando");
        return json({ error: "descricao e data_prevista são obrigatórios" }, 400);
      }
      const { data, error } = await sb
        .from("follow_ups")
        .insert(payload)
        .select("id,descricao,data_prevista,canal_sugerido,prioridade")
        .single();
      if (error) { await log(false, "Falha ao criar follow-up", error.message); return json({ error: error.message }, 500); }
      await log(true, `Follow-up criado: ${payload.descricao}`);
      return json({ ok: true, resumo: `Follow-up criado para ${obra.nome || codigoObra} em ${payload.data_prevista}.`, registro: data });
    }

    if (tipo === "mudar_fase") {
      const update: Record<string, unknown> = {};
      if (dados.fase_michele) update.fase_michele = String(dados.fase_michele);
      if (dados.temperatura) update.temperatura = String(dados.temperatura);
      if (Object.keys(update).length === 0) {
        await log(false, "mudar_fase sem campos", "fase_michele ou temperatura obrigatórios");
        return json({ error: "Informe fase_michele e/ou temperatura" }, 400);
      }
      const { error } = await sb.from("obras").update(update).eq("codigoObra", codigoObra);
      if (error) { await log(false, "Falha ao mudar fase", error.message); return json({ error: error.message }, 500); }
      const partes = [
        update.fase_michele ? `fase ${obra.fase_michele} → ${update.fase_michele}` : null,
        update.temperatura ? `temperatura ${obra.temperatura} → ${update.temperatura}` : null,
      ].filter(Boolean).join(", ");
      await log(true, `Obra atualizada (${partes})`);
      return json({ ok: true, resumo: `${obra.nome || codigoObra}: ${partes}.` });
    }

    if (tipo === "atualizar_obra") {
      const update: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(dados)) {
        if (k === "codigoObra") continue;
        if (OBRA_FIELDS.has(k)) update[k] = v;
      }
      if (Object.keys(update).length === 0) {
        await log(false, "atualizar_obra sem campos válidos");
        return json({ error: "Nenhum campo válido para atualizar" }, 400);
      }
      const { error } = await sb.from("obras").update(update).eq("codigoObra", codigoObra);
      if (error) { await log(false, "Falha ao atualizar obra", error.message); return json({ error: error.message }, 500); }
      const campos = Object.keys(update).join(", ");
      await log(true, `Obra atualizada: ${campos}`);
      return json({ ok: true, resumo: `${obra.nome || codigoObra} atualizada (${campos}).` });
    }

    return json({ error: "Ação não implementada" }, 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await log(false, "Erro inesperado", msg);
    return json({ error: msg }, 500);
  }
});
