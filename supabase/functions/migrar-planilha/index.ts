// Edge function: migrar-planilha
// Lê as 5 abas da planilha Google e faz upsert nas tabelas do Supabase.
// Idempotente — pode rodar mais de uma vez sem duplicar.
import { requireAuth } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';
const SUPA_URL = Deno.env.get('SUPABASE_URL')!;
const SUPA_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function sbHeaders(extra: Record<string, string> = {}) {
  return {
    Authorization: `Bearer ${SUPA_KEY}`,
    apikey: SUPA_KEY,
    'Content-Type': 'application/json',
    ...extra,
  };
}

async function getAccessToken(): Promise<string> {
  const email = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_EMAIL')!;
  let rawKey = Deno.env.get('GOOGLE_PRIVATE_KEY')!;
  rawKey = rawKey.replace(/\\n/g, '\n').trim();
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: email,
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600, iat: now,
  };
  const enc = new TextEncoder();
  const b64url = (buf: ArrayBuffer) => {
    const bytes = new Uint8Array(buf);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  const headerB64 = b64url(enc.encode(JSON.stringify(header)));
  const payloadB64 = b64url(enc.encode(JSON.stringify(payload)));
  const signingInput = `${headerB64}.${payloadB64}`;
  const pemLines = rawKey.split('\n').filter(line =>
    line.trim() !== '' && !line.includes('BEGIN PRIVATE KEY') && !line.includes('END PRIVATE KEY')
  );
  const binaryStr = atob(pemLines.join(''));
  const binaryKey = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) binaryKey[i] = binaryStr.charCodeAt(i);
  const key = await crypto.subtle.importKey(
    'pkcs8', binaryKey.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']
  );
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(signingInput));
  const jwt = `${signingInput}.${b64url(signature)}`;
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const tokenData = await tokenRes.json();
  if (!tokenRes.ok) throw new Error(`Token error: ${JSON.stringify(tokenData)}`);
  return tokenData.access_token;
}

async function fetchRange(sheetId: string, accessToken: string, range: string): Promise<string[][]> {
  const res = await fetch(
    `${SHEETS_BASE}/${sheetId}/values/${encodeURIComponent(range)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (res.status === 400) {
    // aba inexistente -> trata como vazia
    return [];
  }
  if (!res.ok) {
    const txt = await res.text();
    if (/Unable to parse range|Requested entity was not found/i.test(txt)) return [];
    throw new Error(`Sheets API error: ${txt}`);
  }
  const data = await res.json();
  return data.values || [];
}

// Upsert em lotes de 200 linhas
async function upsertAll(table: string, conflictCol: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) return 0;
  let count = 0;
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    const res = await fetch(`${SUPA_URL}/rest/v1/${table}?on_conflict=${conflictCol}`, {
      method: 'POST',
      headers: sbHeaders({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
      body: JSON.stringify(chunk),
    });
    if (!res.ok) throw new Error(`Upsert ${table} falhou: ${await res.text()}`);
    count += chunk.length;
  }
  return count;
}

// Mapeia linhas da aba a objetos, ignorando vazias/duplicadas pelo pk
function mapRows(rows: string[][], fields: (string | null)[], pkField: string): Record<string, string>[] {
  const out: Record<string, string>[] = [];
  const seen = new Set<string>();
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i] || [];
    const obj: Record<string, string> = {};
    for (let c = 0; c < fields.length; c++) {
      const f = fields[c];
      if (!f) continue;
      obj[f] = (r[c] ?? '').toString();
    }
    const pk = (obj[pkField] || '').trim();
    if (!pk) continue;
    if (seen.has(pk)) continue;
    seen.add(pk);
    obj[pkField] = pk;
    out.push(obj);
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const authErr = await requireAuth(req, corsHeaders);
  if (authErr) return authErr;

  try {
    const sheetId = Deno.env.get('GOOGLE_SHEET_ID');
    if (!sheetId) throw new Error('GOOGLE_SHEET_ID not configured');
    const accessToken = await getAccessToken();

    // ===== Obras (A:Z, pular coluna J) =====
    const OBRAS_FIELDS: (string | null)[] = [
      'codigoObra', 'dataCadastro', 'statusProspeccao', 'nome', 'classificacao',
      'construtora', 'responsavel', 'telefone', 'email', null /* gap col J */, 'cidade',
      'localizacao', 'produtoOferecido', 'estagioObra', 'marcouReuniao', 'visita',
      'dataUltimaVisita', 'dataOrcamentoEnviado', 'proximoContato',
      'linkOrcamentoRhoden', 'linkOrcamentoPrado', 'linkOrcamentoImab',
      'observacoes', 'concorrentes', 'prospeccaoIA', 'codigoConstrutora',
    ];
    const obrasRows = await fetchRange(sheetId, accessToken, 'Obras!A:Z');
    const obras = mapRows(obrasRows, OBRAS_FIELDS, 'codigoObra');
    const obrasN = await upsertAll('obras', '"codigoObra"', obras);

    // ===== Atividades (A:G) =====
    const ATIV_FIELDS = ['idAtividade', 'idObra', 'dataAtividade', 'tipoContato', 'status', 'proximoContato', 'comentario'];
    const ativRows = await fetchRange(sheetId, accessToken, 'Atividades!A:G');
    const ativs = mapRows(ativRows, ATIV_FIELDS, 'idAtividade');
    const ativN = await upsertAll('atividades', '"idAtividade"', ativs);

    // ===== Construtoras (A:G) =====
    const CT_FIELDS = ['codigo', 'nome', 'cnpj', 'produto', 'status', 'observacoes', 'prospeccaoIA'];
    const ctRows = await fetchRange(sheetId, accessToken, 'Construtoras!A:G');
    const cts = mapRows(ctRows, CT_FIELDS, 'codigo');
    const ctN = await upsertAll('construtoras', '"codigo"', cts);

    // ===== Atividades Construtoras (A:J) =====
    const AT_FIELDS = [
      'idAtividade', 'codigoConstrutora', 'tipoRegistro',
      'data', 'horario', 'tipoContato', 'status', 'proximoContato', 'comentario', 'criarFollowUp',
    ];
    const atcRows = await fetchRange(sheetId, accessToken, 'Atividades Construtoras!A:J');
    const atcs = mapRows(atcRows, AT_FIELDS, 'idAtividade');
    const atcN = await upsertAll('construtoras_atividades', '"idAtividade"', atcs);

    // ===== Pessoas (A:J) =====
    const PE_FIELDS = [
      'codigoPessoa', 'codigoConstrutora', 'codigoObraAtual',
      'nome', 'cargo', 'whatsapp', 'email', 'observacoes',
      'dataCadastro', 'dataUltimaAtualizacao',
    ];
    const peRows = await fetchRange(sheetId, accessToken, 'Pessoas!A:J');
    const pes = mapRows(peRows, PE_FIELDS, 'codigoPessoa');
    const peN = await upsertAll('pessoas', '"codigoPessoa"', pes);

    return new Response(JSON.stringify({
      success: true,
      obras: obrasN,
      atividades: ativN,
      construtoras: ctN,
      construtoras_atividades: atcN,
      pessoas: peN,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('migrar-planilha error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
