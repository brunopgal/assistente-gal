// Edge function to record budget and presentation views securely
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let body;
    try {
      body = await req.json();
    } catch (e) {
      console.error('Erro ao ler JSON da requisição:', e);
      return new Response(
        JSON.stringify({ ok: false, etapa: 'token ausente', erro: 'Corpo da requisição inválido ou ausente' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { token, tipo } = body || {};
    console.log('Etapa: Token recebido', { token, tipo });

    if (!token || !tipo) {
      return new Response(
        JSON.stringify({ ok: false, etapa: 'token ausente', erro: 'Token e tipo são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (tipo !== 'orcamento' && tipo !== 'apresentacao') {
      return new Response(
        JSON.stringify({ ok: false, etapa: 'token ausente', erro: 'Tipo de abertura inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const SUPA_URL = Deno.env.get('SUPABASE_URL');
    const SUPA_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SUPA_URL || !SUPA_KEY) {
      console.error('Erro: Variáveis de ambiente SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausentes.');
      return new Response(
        JSON.stringify({ ok: false, etapa: 'erro no servidor', erro: 'Variáveis de ambiente do Supabase não configuradas' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Configurar colunas de busca baseadas no tipo de link aberto
    const tableName = tipo === 'orcamento' ? 'orcamento_paginas' : 'apresentacao_paginas';
    const columnToken = tipo === 'orcamento' ? 'token_orcamento' : 'token_apresentacao';
    const queryUrl = `${SUPA_URL}/rest/v1/${tableName}?${columnToken}=eq.${encodeURIComponent(token)}&select=id`;

    console.log(`Etapa: Buscando página. Tabela: ${tableName}, Coluna: ${columnToken}, URL: ${queryUrl}`);

    const headers = {
      Authorization: `Bearer ${SUPA_KEY}`,
      apikey: SUPA_KEY,
      'Content-Type': 'application/json',
    };

    let resPage;
    try {
      resPage = await fetch(queryUrl, { headers });
    } catch (e) {
      console.error('Falha ao consultar tabela:', e);
      return new Response(
        JSON.stringify({ ok: false, etapa: 'pagina nao encontrada', erro: `Falha de rede ao consultar página: ${e instanceof Error ? e.message : String(e)}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!resPage.ok) {
      const errorText = await resPage.text();
      console.error(`Erro na resposta da busca de página (Status: ${resPage.status}):`, errorText);
      return new Response(
        JSON.stringify({ ok: false, etapa: 'pagina nao encontrada', erro: `Erro ao buscar página no banco: ${errorText}` }),
        { status: resPage.status >= 400 && resPage.status < 600 ? resPage.status : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const pages = await resPage.json();
    console.log('Páginas encontradas:', pages);

    if (!pages || pages.length === 0) {
      console.warn(`Página não encontrada para o token ${token} na tabela ${tableName}`);
      return new Response(
        JSON.stringify({ ok: false, etapa: 'pagina nao encontrada', erro: 'Página não encontrada para o token fornecido' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const paginaId = pages[0].id;
    console.log('Etapa: ID encontrado', { paginaId });

    // Inserir registro na tabela orcamento_aberturas
    const insertUrl = `${SUPA_URL}/rest/v1/orcamento_aberturas`;
    const insertPayload = {
      pagina_id: paginaId,
      tipo: tipo,
    };
    console.log('Etapa: Tentando inserir abertura. Payload:', insertPayload);

    let resInsert;
    try {
      resInsert = await fetch(insertUrl, {
        method: 'POST',
        headers: {
          ...headers,
          Prefer: 'return=representation',
        },
        body: JSON.stringify(insertPayload),
      });
    } catch (e) {
      console.error('Falha ao inserir registro de abertura:', e);
      return new Response(
        JSON.stringify({ ok: false, etapa: 'erro no insert', erro: `Falha de rede ao registrar abertura: ${e instanceof Error ? e.message : String(e)}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!resInsert.ok) {
      const errorText = await resInsert.text();
      console.error(`Erro na inserção de abertura (Status: ${resInsert.status}):`, errorText);
      return new Response(
        JSON.stringify({ ok: false, etapa: 'erro no insert', erro: `Erro ao inserir na tabela de aberturas: ${errorText}` }),
        { status: resInsert.status >= 400 && resInsert.status < 600 ? resInsert.status : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const insertResult = await resInsert.json();
    console.log('Etapa: Resultado do insert:', insertResult);

    return new Response(
      JSON.stringify({ ok: true, tipo, pagina_id: paginaId }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Erro global na Edge Function:', error);
    const msg = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ ok: false, etapa: 'erro no servidor', erro: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
