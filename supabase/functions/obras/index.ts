// Edge function: Obras — agora lê e grava em public.obras (Supabase),
// preservando 100% do contrato JSON consumido pelo frontend.
import { requireAuth } from '../_shared/auth.ts';
import { geocodeAndSaveObra, buildObraQuery, normalizeText, runInBackground } from '../_shared/geocode.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const FIELDS = [
  'codigoObra', 'dataCadastro', 'statusProspeccao', 'nome', 'classificacao',
  'construtora', 'responsavel', 'telefone', 'email', 'cidade', 'localizacao',
  'produtoOferecido', 'estagioObra', 'marcouReuniao', 'visita',
  'dataUltimaVisita', 'dataOrcamentoEnviado', 'proximoContato',
  'linkOrcamentoRhoden', 'linkOrcamentoPrado', 'linkOrcamentoImab',
  'observacoes', 'concorrentes', 'prospeccaoIA', 'codigoConstrutora',
  'statusDesde',
];

const SUPA_URL = Deno.env.get('SUPABASE_URL')!;
const SUPA_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const REST = `${SUPA_URL}/rest/v1/obras`;

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
  for (const f of FIELDS) {
    if (body[f] !== undefined && body[f] !== null) out[f] = String(body[f]);
  }
  return out;
}

function withId(obra: Record<string, string>): Record<string, string> {
  return { ...obra, id: obra.codigoObra };
}

async function listAll(): Promise<Record<string, string>[]> {
  const res = await fetch(`${REST}?select=*`, { headers: sbHeaders() });
  if (!res.ok) throw new Error(`Supabase error: ${await res.text()}`);
  return await res.json();
}

async function getOne(id: string): Promise<Record<string, string> | null> {
  const res = await fetch(`${REST}?codigoObra=eq.${encodeURIComponent(id)}&select=*`, { headers: sbHeaders() });
  if (!res.ok) throw new Error(`Supabase error: ${await res.text()}`);
  const arr = await res.json();
  return arr[0] || null;
}

async function generateNextId(): Promise<string> {
  const res = await fetch(`${REST}?select=codigoObra&order=codigoObra.desc&limit=200`, { headers: sbHeaders() });
  if (!res.ok) throw new Error(`Supabase error: ${await res.text()}`);
  const arr = await res.json();
  let max = 0;
  for (const r of arr) {
    const m = String(r.codigoObra || '').match(/^OBRA(\d+)$/i);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `OBRA${String(max + 1).padStart(9, '0')}`;
}

function todayBR(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

async function ensureConstrutora(nome: string): Promise<string> {
  try {
    const res = await fetch(`${SUPA_URL}/functions/v1/construtoras/ensure`, {
      method: 'POST',
      headers: sbHeaders(),
      body: JSON.stringify({ nome }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.codigo) return data.codigo;
  } catch (e) { console.warn('ensure construtora falhou:', e); }
  return '';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const authErr = await requireAuth(req, corsHeaders);
  if (authErr) return authErr;

  try {
    const url = new URL(req.url);
    const parts = url.pathname.split('/').filter(Boolean);
    const action = parts[parts.length - 1];
    const isIdAction = action !== 'obras' && action !== '' && action !== undefined;

    if (req.method === 'GET') {
      if (isIdAction) {
        const obra = await getOne(decodeURIComponent(action));
        if (!obra) {
          return new Response(JSON.stringify({ error: 'Obra não encontrada' }), {
            status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify(withId(obra)), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const all = await listAll();
      return new Response(JSON.stringify(all.map(withId)), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (req.method === 'POST') {
      const raw = await req.json();
      const body = pickFields(raw);
      if (body.construtora && body.construtora.trim() && !body.codigoConstrutora) {
        const codigo = await ensureConstrutora(body.construtora.trim());
        if (codigo) body.codigoConstrutora = codigo;
      }
      body.codigoObra = body.codigoObra && body.codigoObra.trim() ? body.codigoObra.trim() : await generateNextId();
      if (!body.dataCadastro) body.dataCadastro = todayBR();

      const res = await fetch(REST, {
        method: 'POST',
        headers: sbHeaders({ Prefer: 'return=representation' }),
        body: JSON.stringify([body]),
      });
      if (!res.ok) throw new Error(`Supabase error: ${await res.text()}`);
      const inserted = (await res.json())[0] || body;
      runInBackground(geocodeAndSaveObra(inserted));
      return new Response(JSON.stringify({ success: true, id: body.codigoObra, ...withId(inserted) }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (req.method === 'PUT') {
      if (!isIdAction) throw new Error('ID da obra obrigatório');
      const id = decodeURIComponent(action);
      const raw = await req.json();
      const body = pickFields(raw);
      delete body.codigoObra;

      const old = await getOne(id);
      if (!old) throw new Error('Obra não encontrada');

      const res = await fetch(`${REST}?codigoObra=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: sbHeaders({ Prefer: 'return=representation' }),
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Supabase error: ${await res.text()}`);
      const updated = (await res.json())[0] || { ...old, ...body };

      const oldQ = normalizeText(buildObraQuery(old));
      const newQ = normalizeText(buildObraQuery(updated));
      if (newQ && newQ !== oldQ) runInBackground(geocodeAndSaveObra(updated));

      return new Response(JSON.stringify({ success: true, id, ...withId(updated) }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (req.method === 'PATCH') {
      if (!isIdAction) throw new Error('ID da obra obrigatório');
      const id = decodeURIComponent(action);
      const { field, value } = await req.json();
      if (!FIELDS.includes(field)) throw new Error('Campo inválido');

      const old = field === 'localizacao' || field === 'cidade' ? await getOne(id) : null;

      const res = await fetch(`${REST}?codigoObra=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: sbHeaders(),
        body: JSON.stringify({ [field]: value ?? '' }),
      });
      if (!res.ok) throw new Error(`Supabase error: ${await res.text()}`);

      if (old) {
        const before = normalizeText(buildObraQuery(old));
        const merged = { ...old, [field]: String(value ?? '') };
        const after = normalizeText(buildObraQuery(merged));
        if (after && after !== before) runInBackground(geocodeAndSaveObra(merged));
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (req.method === 'DELETE') {
      if (!isIdAction) throw new Error('ID da obra obrigatório');
      const id = decodeURIComponent(action);
      const res = await fetch(`${REST}?codigoObra=eq.${encodeURIComponent(id)}`, {
        method: 'DELETE', headers: sbHeaders(),
      });
      if (!res.ok) throw new Error(`Supabase error: ${await res.text()}`);
      // Limpa coordenadas associadas (best effort)
      try {
        await fetch(`${SUPA_URL}/rest/v1/obras_coordenadas?codigoObra=eq.${encodeURIComponent(id)}`, {
          method: 'DELETE', headers: sbHeaders(),
        });
      } catch (_) { /* ignore */ }
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
