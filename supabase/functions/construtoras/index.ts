// Edge function: Construtoras + Atividades Construtoras — agora em Supabase.
// Mantém EXATAMENTE o mesmo contrato de rotas e nomes de campos.
import { requireAuth } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const CT_FIELDS = ['codigo', 'nome', 'cnpj', 'produto', 'status', 'observacoes', 'prospeccaoIA'];
const AT_FIELDS = [
  'idAtividade', 'codigoConstrutora', 'tipoRegistro',
  'data', 'horario', 'tipoContato', 'status', 'proximoContato', 'comentario', 'criarFollowUp',
];

const SUPA_URL = Deno.env.get('SUPABASE_URL')!;
const SUPA_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CT_REST = `${SUPA_URL}/rest/v1/construtoras`;
const AT_REST = `${SUPA_URL}/rest/v1/construtoras_atividades`;
const OBRAS_REST = `${SUPA_URL}/rest/v1/obras`;
const ATIV_REST = `${SUPA_URL}/rest/v1/atividades`;

function sbHeaders(extra: Record<string, string> = {}) {
  return {
    Authorization: `Bearer ${SUPA_KEY}`,
    apikey: SUPA_KEY,
    'Content-Type': 'application/json',
    ...extra,
  };
}

function pick(body: Record<string, unknown>, fields: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of fields) if (body[f] !== undefined && body[f] !== null) out[f] = String(body[f]);
  return out;
}

function normalizeName(s: string): string {
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
}

async function listAll(rest: string): Promise<any[]> {
  const res = await fetch(`${rest}?select=*`, { headers: sbHeaders() });
  if (!res.ok) throw new Error(`Supabase error: ${await res.text()}`);
  return await res.json();
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

async function findOrCreateConstrutoraByName(nome: string): Promise<string> {
  const target = normalizeName(nome);
  if (!target) return '';
  const all = await listAll(CT_REST);
  for (const c of all) {
    if (normalizeName(c.nome || '') === target) return c.codigo;
  }
  const codigo = await generateNextId(CT_REST, 'codigo', 'CT', 9);
  const row = { codigo, nome: nome.trim(), cnpj: '', produto: '', status: 'Prospecção', observacoes: '', prospeccaoIA: '' };
  const res = await fetch(CT_REST, {
    method: 'POST',
    headers: sbHeaders({ Prefer: 'return=minimal' }),
    body: JSON.stringify([row]),
  });
  if (!res.ok) throw new Error(`Supabase error: ${await res.text()}`);
  return codigo;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const authErr = await requireAuth(req, corsHeaders);
  if (authErr) return authErr;

  try {
    const url = new URL(req.url);
    const parts = url.pathname.split('/').filter(Boolean);
    const idx = parts.findIndex(p => p === 'construtoras');
    const seg1 = idx >= 0 && parts[idx + 1] ? decodeURIComponent(parts[idx + 1]) : '';
    const seg2 = idx >= 0 && parts[idx + 2] ? decodeURIComponent(parts[idx + 2]) : '';

    // ===== sync-construtoras =====
    if (seg1 === 'sync-construtoras' && req.method === 'POST') {
      const obras = await listAll(OBRAS_REST);
      const cts = await listAll(CT_REST);
      const ctByNome = new Map<string, any>();
      for (const c of cts) ctByNome.set(normalizeName(c.nome || ''), c);

      const produtosPorNome = new Map<string, Set<string>>();
      const nomesUnicos: string[] = [];
      const seen = new Set<string>();
      for (const o of obras) {
        const nome = String(o.construtora || '').trim();
        if (!nome) continue;
        const k = normalizeName(nome);
        if (!seen.has(k)) { seen.add(k); nomesUnicos.push(nome); }
        const prods = String(o.produtoOferecido || '').split(',').map(s => s.trim()).filter(Boolean);
        if (!produtosPorNome.has(k)) produtosPorNome.set(k, new Set());
        const set = produtosPorNome.get(k)!;
        for (const p of prods) set.add(p);
      }

      let criadas = 0;
      for (const nome of nomesUnicos) {
        const k = normalizeName(nome);
        if (!ctByNome.has(k)) {
          const codigo = await findOrCreateConstrutoraByName(nome);
          ctByNome.set(k, { codigo, nome, produto: '' });
          criadas++;
        }
      }

      let produtosAtualizados = 0;
      for (const [k, ct] of ctByNome) {
        const oferecidos = produtosPorNome.get(k);
        if (!oferecidos || oferecidos.size === 0) continue;
        const atuais = new Set(String(ct.produto || '').split(',').map((s: string) => s.trim()).filter(Boolean));
        let mudou = false;
        for (const p of oferecidos) if (!atuais.has(p)) { atuais.add(p); mudou = true; }
        if (!mudou) continue;
        const novoValor = Array.from(atuais).join(', ');
        const res = await fetch(`${CT_REST}?codigo=eq.${encodeURIComponent(ct.codigo)}`, {
          method: 'PATCH', headers: sbHeaders(), body: JSON.stringify({ produto: novoValor }),
        });
        if (res.ok) produtosAtualizados++;
      }

      return new Response(JSON.stringify({ success: true, criadas, total: nomesUnicos.length, produtosAtualizados }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ===== sync-atividades =====
    if (seg1 === 'sync-atividades' && req.method === 'POST') {
      const obras = await listAll(OBRAS_REST);
      const atvs = await listAll(ATIV_REST);
      const atcs = await listAll(AT_REST);

      const obraMap = new Map<string, { nome: string; construtora: string }>();
      for (const o of obras) {
        const id = String(o.codigoObra || '').trim().toUpperCase();
        if (id) obraMap.set(id, { nome: o.nome || '', construtora: o.construtora || '' });
      }
      const mirrored = new Set<string>();
      for (const a of atcs) {
        const m = String(a.comentario || '').match(/\[ORIG:([A-Z0-9]+)\]/i);
        if (m) mirrored.add(m[1].toUpperCase());
      }

      let espelhadas = 0;
      let baseMax = 0;
      for (const a of atcs) {
        const m = String(a.idAtividade || '').match(/^ATC(\d+)$/i);
        if (m) baseMax = Math.max(baseMax, parseInt(m[1], 10));
      }

      for (const a of atvs) {
        const idAtv = String(a.idAtividade || '').trim();
        if (!idAtv || mirrored.has(idAtv.toUpperCase())) continue;
        const meta = obraMap.get(String(a.idObra || '').trim().toUpperCase());
        if (!meta || !meta.construtora) continue;
        const codigoCT = await findOrCreateConstrutoraByName(meta.construtora);
        if (!codigoCT) continue;
        baseMax++;
        const novoId = `ATC${String(baseMax).padStart(6, '0')}`;
        const novoComentario = `[ORIG:${idAtv}] Obra: ${meta.nome} — ${a.comentario || ''}`;
        const row = {
          idAtividade: novoId, codigoConstrutora: codigoCT, tipoRegistro: 'atividade',
          data: a.dataAtividade || '', horario: '',
          tipoContato: a.tipoContato || '', status: a.status || '',
          proximoContato: a.proximoContato || '', comentario: novoComentario, criarFollowUp: '',
        };
        const res = await fetch(AT_REST, {
          method: 'POST', headers: sbHeaders({ Prefer: 'return=minimal' }), body: JSON.stringify([row]),
        });
        if (res.ok) { espelhadas++; mirrored.add(idAtv.toUpperCase()); }
      }

      return new Response(JSON.stringify({ success: true, espelhadas }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ===== ensure (interna) =====
    if (seg1 === 'ensure' && req.method === 'POST') {
      const body = await req.json();
      const nome = String(body?.nome || '').trim();
      if (!nome) throw new Error('nome obrigatório');
      const codigo = await findOrCreateConstrutoraByName(nome);
      return new Response(JSON.stringify({ success: true, codigo }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ===== mirror-atividade (interna) =====
    if (seg1 === 'mirror-atividade' && req.method === 'POST') {
      const body = await req.json();
      const { idAtividade, nomeObra, construtora, dataAtividade, tipoContato, status, proximoContato, comentario } = body || {};
      if (!idAtividade || !construtora) throw new Error('idAtividade e construtora obrigatórios');
      const codigoCT = await findOrCreateConstrutoraByName(String(construtora));
      if (!codigoCT) throw new Error('falha ao obter código da construtora');

      // dedupe
      const dupeRes = await fetch(`${AT_REST}?select=idAtividade&comentario=ilike.*${encodeURIComponent(`[ORIG:${idAtividade}]`)}*&limit=1`, { headers: sbHeaders() });
      const dupeArr = dupeRes.ok ? await dupeRes.json() : [];
      if (dupeArr[0]) {
        return new Response(JSON.stringify({ success: true, skipped: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const novoId = await generateNextId(AT_REST, 'idAtividade', 'ATC', 6);
      const novoComentario = `[ORIG:${idAtividade}] Obra: ${nomeObra || ''} — ${comentario || ''}`;
      const row = {
        idAtividade: novoId, codigoConstrutora: codigoCT, tipoRegistro: 'atividade',
        data: dataAtividade || '', horario: '',
        tipoContato: tipoContato || '', status: status || '',
        proximoContato: proximoContato || '', comentario: novoComentario, criarFollowUp: '',
      };
      const res = await fetch(AT_REST, {
        method: 'POST', headers: sbHeaders({ Prefer: 'return=minimal' }), body: JSON.stringify([row]),
      });
      if (!res.ok) throw new Error(`Supabase error: ${await res.text()}`);
      return new Response(JSON.stringify({ success: true, idAtividade: novoId, codigoCT }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ===== /construtoras/atividades =====
    if (seg1 === 'atividades') {
      if (req.method === 'GET') {
        let qs = '?select=*';
        const filtroCodigo = url.searchParams.get('codigo');
        if (filtroCodigo) qs += `&codigoConstrutora=eq.${encodeURIComponent(filtroCodigo)}`;
        const res = await fetch(`${AT_REST}${qs}`, { headers: sbHeaders() });
        if (!res.ok) throw new Error(`Supabase error: ${await res.text()}`);
        return new Response(await res.text(), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (req.method === 'POST') {
        const raw = await req.json();
        const body = pick(raw, AT_FIELDS);
        if (!body.codigoConstrutora) throw new Error('codigoConstrutora obrigatório');
        body.idAtividade = body.idAtividade || await generateNextId(AT_REST, 'idAtividade', 'ATC', 6);
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

    // ===== CRUD /construtoras =====
    if (req.method === 'GET') {
      if (seg1) {
        const res = await fetch(`${CT_REST}?codigo=eq.${encodeURIComponent(seg1)}&select=*`, { headers: sbHeaders() });
        if (!res.ok) throw new Error(`Supabase error: ${await res.text()}`);
        const arr = await res.json();
        if (!arr[0]) {
          return new Response(JSON.stringify({ error: 'Construtora não encontrada' }), {
            status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify(arr[0]), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const res = await fetch(`${CT_REST}?select=*`, { headers: sbHeaders() });
      if (!res.ok) throw new Error(`Supabase error: ${await res.text()}`);
      return new Response(await res.text(), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (req.method === 'POST') {
      const raw = await req.json();
      const body = pick(raw, CT_FIELDS);
      body.codigo = body.codigo && body.codigo.trim() ? body.codigo.trim() : await generateNextId(CT_REST, 'codigo', 'CT', 9);
      const res = await fetch(CT_REST, {
        method: 'POST', headers: sbHeaders({ Prefer: 'return=representation' }), body: JSON.stringify([body]),
      });
      if (!res.ok) throw new Error(`Supabase error: ${await res.text()}`);
      const inserted = (await res.json())[0] || body;
      return new Response(JSON.stringify({ success: true, ...inserted }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (req.method === 'PUT' && seg1) {
      const raw = await req.json();
      const body = pick(raw, CT_FIELDS);
      delete body.codigo;
      const res = await fetch(`${CT_REST}?codigo=eq.${encodeURIComponent(seg1)}`, {
        method: 'PATCH', headers: sbHeaders({ Prefer: 'return=representation' }), body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Supabase error: ${await res.text()}`);
      const arr = await res.json();
      if (!arr[0]) throw new Error('Construtora não encontrada');
      return new Response(JSON.stringify({ success: true, ...arr[0] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (req.method === 'DELETE' && seg1) {
      const res = await fetch(`${CT_REST}?codigo=eq.${encodeURIComponent(seg1)}`, {
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
