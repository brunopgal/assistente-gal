// Edge function: Pessoas — agora em public.pessoas (Supabase)
import { requireAuth } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const FIELDS = [
  'codigoPessoa', 'codigoConstrutora', 'codigoObraAtual',
  'nome', 'cargo', 'whatsapp', 'email', 'observacoes',
  'dataCadastro', 'dataUltimaAtualizacao',
];

const SUPA_URL = Deno.env.get('SUPABASE_URL')!;
const SUPA_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const REST = `${SUPA_URL}/rest/v1/pessoas`;
const AT_REST = `${SUPA_URL}/rest/v1/pessoas_atividades`;

const AT_FIELDS = [
  'idAtividade', 'codigoPessoa', 'tipoRegistro',
  'data', 'horario', 'tipoContato', 'status', 'proximoContato', 'comentario', 'criarFollowUp',
  'idObra', 'codigoConstrutora',
];

function sbHeaders(extra: Record<string, string> = {}) {
  return {
    Authorization: `Bearer ${SUPA_KEY}`,
    apikey: SUPA_KEY,
    'Content-Type': 'application/json',
    ...extra,
  };
}

function pickFields(body: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of FIELDS) if (body[f] !== undefined && body[f] !== null) out[f] = String(body[f]);
  return out;
}

function pick(body: Record<string, unknown>, fields: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of fields) if (body[f] !== undefined && body[f] !== null) out[f] = String(body[f]);
  return out;
}

async function generateNextId(rest: string, idField: string, prefix: string, padLen: number): Promise<string> {
  const res = await fetch(`${rest}?select=${idField}&order=${idField}.desc&limit=500`, { headers: sbHeaders() });
  if (!res.ok) throw new Error(`Supabase error: ${await res.text()}`);
  const arr = await res.json();
  let max = 0;
  const re = new RegExp(`^${prefix}(\\d+)$`, 'i');
  for (const r of arr) {
    const m = String(r[idField] || '').match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${prefix}${String(max + 1).padStart(padLen, '0')}`;
}

function todayBR(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const authErr = await requireAuth(req, corsHeaders);
  if (authErr) return authErr;

  try {
    const url = new URL(req.url);
    const parts = url.pathname.split('/').filter(Boolean);
    const idx = parts.findIndex(p => p === 'pessoas');
    const seg1 = idx >= 0 && parts[idx + 1] ? decodeURIComponent(parts[idx + 1]) : '';
    const seg2 = idx >= 0 && parts[idx + 2] ? decodeURIComponent(parts[idx + 2]) : '';

    // ===== /pessoas/atividades =====
    if (seg1 === 'atividades') {
      if (req.method === 'GET') {
        let qs = '?select=*';
        const filtroCodigo = url.searchParams.get('codigo');
        if (filtroCodigo) qs += `&codigoPessoa=eq.${encodeURIComponent(filtroCodigo)}`;
        const res = await fetch(`${AT_REST}${qs}`, { headers: sbHeaders() });
        if (!res.ok) throw new Error(`Supabase error: ${await res.text()}`);
        return new Response(await res.text(), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (req.method === 'POST') {
        const raw = await req.json();
        const body = pick(raw, AT_FIELDS);
        if (!body.codigoPessoa) throw new Error('codigoPessoa obrigatório');
        body.idAtividade = body.idAtividade || await generateNextId(AT_REST, 'idAtividade', 'ATP', 6);
        if (!body.tipoRegistro) body.tipoRegistro = 'atividade';
        if (!body.data) {
          const d = new Date();
          body.data = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
        }
        const res = await fetch(AT_REST, {
          method: 'POST', headers: sbHeaders({ Prefer: 'return=representation' }), body: JSON.stringify([body]),
        });
        if (!res.ok) throw new Error(`Supabase error: ${await res.text()}`);
        const inserted = (await res.json())[0] || body;
        return new Response(JSON.stringify({ success: true, ...inserted }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (req.method === 'PUT' && seg2) {
        const raw = await req.json();
        const body = pick(raw, AT_FIELDS);
        delete body.idAtividade;
        const res = await fetch(`${AT_REST}?idAtividade=eq.${encodeURIComponent(seg2)}`, {
          method: 'PATCH', headers: sbHeaders({ Prefer: 'return=representation' }), body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`Supabase error: ${await res.text()}`);
        const arr = await res.json();
        if (!arr[0]) throw new Error('Atividade não encontrada');
        return new Response(JSON.stringify({ success: true, ...arr[0] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (req.method === 'DELETE' && seg2) {
        const res = await fetch(`${AT_REST}?idAtividade=eq.${encodeURIComponent(seg2)}`, {
          method: 'DELETE', headers: sbHeaders(),
        });
        if (!res.ok) throw new Error(`Supabase error: ${await res.text()}`);
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // ===== CRUD /pessoas =====
    if (req.method === 'GET') {
      if (seg1) {
        const res = await fetch(`${REST}?codigoPessoa=eq.${encodeURIComponent(seg1)}&select=*`, { headers: sbHeaders() });
        if (!res.ok) throw new Error(`Supabase error: ${await res.text()}`);
        const arr = await res.json();
        if (!arr[0]) {
          return new Response(JSON.stringify({ error: 'Pessoa não encontrada' }), {
            status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify(arr[0]), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      let qs = '?select=*';
      const fCT = url.searchParams.get('codigoConstrutora');
      const fOB = url.searchParams.get('codigoObra');
      if (fCT) qs += `&codigoConstrutora=eq.${encodeURIComponent(fCT)}`;
      if (fOB) qs += `&codigoObraAtual=eq.${encodeURIComponent(fOB)}`;
      const res = await fetch(`${REST}${qs}`, { headers: sbHeaders() });
      if (!res.ok) throw new Error(`Supabase error: ${await res.text()}`);
      return new Response(await res.text(), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (req.method === 'POST') {
      const raw = await req.json();
      const body = pickFields(raw);
      body.codigoPessoa = body.codigoPessoa && body.codigoPessoa.trim() ? body.codigoPessoa.trim() : await generateNextId(REST, 'codigoPessoa', 'PE', 9);
      if (!body.dataCadastro) body.dataCadastro = todayBR();
      body.dataUltimaAtualizacao = todayBR();
      const res = await fetch(REST, {
        method: 'POST',
        headers: sbHeaders({ Prefer: 'return=representation' }),
        body: JSON.stringify([body]),
      });
      if (!res.ok) throw new Error(`Supabase error: ${await res.text()}`);
      const inserted = (await res.json())[0] || body;
      return new Response(JSON.stringify({ success: true, ...inserted }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (req.method === 'PUT' && seg1) {
      const raw = await req.json();
      const body = pickFields(raw);
      delete body.codigoPessoa;
      body.dataUltimaAtualizacao = todayBR();
      const res = await fetch(`${REST}?codigoPessoa=eq.${encodeURIComponent(seg1)}`, {
        method: 'PATCH',
        headers: sbHeaders({ Prefer: 'return=representation' }),
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Supabase error: ${await res.text()}`);
      const arr = await res.json();
      if (!arr[0]) throw new Error('Pessoa não encontrada');
      return new Response(JSON.stringify({ success: true, ...arr[0] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (req.method === 'DELETE' && seg1) {
      const res = await fetch(`${REST}?codigoPessoa=eq.${encodeURIComponent(seg1)}`, {
        method: 'DELETE', headers: sbHeaders(),
      });
      if (!res.ok) throw new Error(`Supabase error: ${await res.text()}`);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
