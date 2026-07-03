// Edge function: Atividades (CRM por obra) — agora em public.atividades (Supabase)
import { requireAuth } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const FIELDS = ['idAtividade', 'idObra', 'dataAtividade', 'tipoContato', 'status', 'proximoContato', 'comentario', 'codigoConstrutora', 'codigoPessoa'];

const SUPA_URL = Deno.env.get('SUPABASE_URL')!;
const SUPA_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const REST = `${SUPA_URL}/rest/v1/atividades`;

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

async function generateNextId(): Promise<string> {
  const res = await fetch(`${REST}?select=idAtividade&order=idAtividade.desc&limit=500`, { headers: sbHeaders() });
  if (!res.ok) throw new Error(`Supabase error: ${await res.text()}`);
  const arr = await res.json();
  let max = 0;
  for (const r of arr) {
    const m = String(r.idAtividade || '').match(/^ATIV(\d+)$/i);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `ATIV${String(max + 1).padStart(6, '0')}`;
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
    const idxA = parts.findIndex(p => p === 'atividades');
    const pathId = idxA >= 0 && parts[idxA + 1] ? decodeURIComponent(parts[idxA + 1]) : '';
    const obraIdFilter = url.searchParams.get('idObra');

    if (req.method === 'GET') {
      if (pathId) {
        const res = await fetch(`${REST}?idAtividade=eq.${encodeURIComponent(pathId)}&select=*`, { headers: sbHeaders() });
        if (!res.ok) throw new Error(`Supabase error: ${await res.text()}`);
        const arr = await res.json();
        if (!arr[0]) {
          return new Response(JSON.stringify({ error: 'Atividade não encontrada' }), {
            status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify(arr[0]), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      let qs = '?select=*';
      if (obraIdFilter) qs += `&idObra=eq.${encodeURIComponent(obraIdFilter)}`;
      const res = await fetch(`${REST}${qs}`, { headers: sbHeaders() });
      if (!res.ok) throw new Error(`Supabase error: ${await res.text()}`);
      return new Response(await res.text(), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (req.method === 'POST') {
      const raw = await req.json();
      const body = pickFields(raw);
      if (!body.idObra || !body.idObra.trim()) throw new Error('ID da obra obrigatório (idObra)');
      body.idAtividade = body.idAtividade && body.idAtividade.trim() ? body.idAtividade.trim() : await generateNextId();
      if (!body.dataAtividade) body.dataAtividade = todayBR();

      const res = await fetch(REST, {
        method: 'POST',
        headers: sbHeaders({ Prefer: 'return=representation' }),
        body: JSON.stringify([body]),
      });
      if (!res.ok) throw new Error(`Supabase error: ${await res.text()}`);
      const inserted = (await res.json())[0] || body;

      // Espelhar para Atividades Construtoras (não bloqueia em caso de erro)
      try {
        const obraRes = await fetch(
          `${SUPA_URL}/rest/v1/obras?codigoObra=eq.${encodeURIComponent(body.idObra)}&select=nome,construtora`,
          { headers: sbHeaders() }
        );
        const obras = await obraRes.json().catch(() => []);
        const obra = obras[0];
        if (obra && (obra.construtora || '').trim()) {
          await fetch(`${SUPA_URL}/functions/v1/construtoras/mirror-atividade`, {
            method: 'POST',
            headers: sbHeaders(),
            body: JSON.stringify({
              idAtividade: body.idAtividade,
              nomeObra: obra.nome || '',
              construtora: obra.construtora,
              dataAtividade: body.dataAtividade,
              tipoContato: body.tipoContato,
              status: body.status,
              proximoContato: body.proximoContato,
              comentario: body.comentario,
            }),
          });
        }
      } catch (e) { console.warn('mirror atividade falhou:', e); }

      return new Response(JSON.stringify({ success: true, ...inserted }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (req.method === 'PUT') {
      if (!pathId) throw new Error('ID da atividade obrigatório no path');
      const raw = await req.json();
      const body = pickFields(raw);
      delete body.idAtividade;
      const res = await fetch(`${REST}?idAtividade=eq.${encodeURIComponent(pathId)}`, {
        method: 'PATCH',
        headers: sbHeaders({ Prefer: 'return=representation' }),
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Supabase error: ${await res.text()}`);
      const arr = await res.json();
      if (!arr[0]) throw new Error(`Atividade ${pathId} não encontrada`);
      return new Response(JSON.stringify({ success: true, ...arr[0] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (req.method === 'DELETE') {
      if (!pathId) throw new Error('ID da atividade obrigatório no path');
      const res = await fetch(`${REST}?idAtividade=eq.${encodeURIComponent(pathId)}`, {
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
