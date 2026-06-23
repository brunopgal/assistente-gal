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
    const { token, tipo } = await req.json();
    if (!token || !tipo) {
      return new Response(JSON.stringify({ error: 'Token and tipo are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (tipo !== 'orcamento' && tipo !== 'apresentacao') {
      return new Response(JSON.stringify({ error: 'Invalid tipo value' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const SUPA_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPA_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Configurar colunas de busca baseadas no tipo de link aberto
    const tableName = tipo === 'orcamento' ? 'orcamento_paginas' : 'apresentacao_paginas';
    const columnToken = tipo === 'orcamento' ? 'token_orcamento' : 'token_apresentacao';
    const queryUrl = `${SUPA_URL}/rest/v1/${tableName}?${columnToken}=eq.${encodeURIComponent(token)}&select=id`;

    const headers = {
      Authorization: `Bearer ${SUPA_KEY}`,
      apikey: SUPA_KEY,
      'Content-Type': 'application/json',
    };

    // Buscar o ID da página associado ao token
    const resPage = await fetch(queryUrl, { headers });
    if (!resPage.ok) {
      throw new Error(`Error fetching page: ${await resPage.text()}`);
    }

    const pages = await resPage.json();
    if (pages.length === 0) {
      return new Response(JSON.stringify({ error: 'Página não encontrada' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const paginaId = pages[0].id;

    // Inserir registro na tabela orcamento_aberturas
    const insertUrl = `${SUPA_URL}/rest/v1/orcamento_aberturas`;
    const resInsert = await fetch(insertUrl, {
      method: 'POST',
      headers: {
        ...headers,
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        pagina_id: paginaId,
        tipo: tipo,
      }),
    });

    if (!resInsert.ok) {
      throw new Error(`Error inserting abertura: ${await resInsert.text()}`);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error registering page view:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
