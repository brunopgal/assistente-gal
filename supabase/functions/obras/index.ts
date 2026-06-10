const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

// EXACT mapping matching the real Google Sheet structure (A..X = 24 columns)
// IMPORTANT: column J is intentionally empty in the real sheet (gap between Email and Cidade Obra)
const SHEET_HEADERS = [
  'codigoObra', 'dataCadastro', 'statusProspeccao', 'nome', 'classificacao',
  'construtora', 'responsavel', 'telefone', 'email', '_empty', 'cidade',
  'localizacao', 'produtoOferecido', 'estagioObra', 'marcouReuniao', 'visita',
  'dataUltimaVisita', 'dataOrcamentoEnviado', 'proximoContato',
  'linkOrcamentoRhoden', 'linkOrcamentoPrado', 'linkOrcamentoImab',
  'observacoes', 'concorrentes', 'prospeccaoIA', 'codigoConstrutora',
];

const SHEET_HEADER_ROW = [
  'ID', 'Data de cadastro', 'Status da prospecção', 'Nome da obra',
  'Classificação da obra', 'Construtora/Cliente', 'Responsável/Contato',
  'Telefone/Whastapp', 'Email', '', 'Cidade Obra', 'Localização/Bairro Obra',
  'Produto Oferecido', 'Estágio da obra', 'Marcou Reunião?', 'Visita',
  'Data da última visita', 'Data orçamento enviado', 'Próximo contato/Follow up',
  'Link do orçamento/PDF  RHODEN', 'Link do orçamento/PDF  PRADO',
  'Link do orçamento/PDF  IMAB', 'Observação', 'Concorrentes', 'Prospecção IA',
  'Codigo Construtora',
];

const RANGE = 'Obras!A:Z';
const LAST_COL = 'Z';

async function getAccessToken(): Promise<string> {
  const email = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_EMAIL')!;
  let rawKey = Deno.env.get('GOOGLE_PRIVATE_KEY')!;
  rawKey = rawKey.replace(/\\n/g, '\n').trim();

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
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

function rowToObra(row: string[]): Record<string, string> {
  const obra: Record<string, string> = {};
  SHEET_HEADERS.forEach((h, i) => { obra[h] = row[i] || ''; });
  // 'id' is the logical ID (column A) — same as codigoObra
  obra.id = obra.codigoObra;
  return obra;
}

function bodyToRow(body: Record<string, string>): string[] {
  return SHEET_HEADERS.map(h => body[h] ?? '');
}

function generateNextId(rows: string[][]): string {
  let maxNum = 0;
  for (let i = 1; i < rows.length; i++) {
    const id = rows[i]?.[0] || '';
    const m = id.match(/^OBRA(\d+)$/i);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > maxNum) maxNum = n;
    }
  }
  return `OBRA${String(maxNum + 1).padStart(9, '0')}`;
}

async function ensureHeader(sheetId: string, accessToken: string) {
  const checkRes = await fetch(
    `${SHEETS_BASE}/${sheetId}/values/${encodeURIComponent(`Obras!A1:${LAST_COL}1`)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const checkData = await checkRes.json();
  if (!checkRes.ok) {
    if (isRateLimitError(JSON.stringify(checkData))) return;
    throw new Error(`Sheets API error: ${JSON.stringify(checkData)}`);
  }
  if (!checkData.values || checkData.values.length === 0) {
    await fetch(
      `${SHEETS_BASE}/${sheetId}/values/${encodeURIComponent(`Obras!A1:${LAST_COL}1`)}?valueInputOption=RAW`,
      {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [SHEET_HEADER_ROW] }),
      }
    );
  }
  headerEnsureCache = { key: sheetId, ts: Date.now() };
}

// Cache em memória para reduzir chamadas à Sheets API (quota 60/min)
let rowsCache: { key: string; rows: string[][]; ts: number } | null = null;
let headerEnsureCache: { key: string; ts: number } | null = null;
const CACHE_TTL_MS = 60_000;
const HEADER_CACHE_TTL_MS = 10 * 60_000;

function invalidateRowsCache() { rowsCache = null; }

function shouldEnsureHeader(sheetId: string): boolean {
  const now = Date.now();
  return !headerEnsureCache || headerEnsureCache.key !== sheetId || (now - headerEnsureCache.ts) > HEADER_CACHE_TTL_MS;
}

function isRateLimitError(message: string): boolean {
  return /\b429\b|RESOURCE_EXHAUSTED|RATE_LIMIT_EXCEEDED|quota/i.test(message);
}

function rateLimitPayload() {
  return {
    error: 'A planilha atingiu o limite temporário de leituras. Aguarde alguns instantes e tente novamente.',
    fallback: true,
    rateLimited: true,
  };
}

async function fetchAllRows(sheetId: string, accessToken: string, useCache = true): Promise<string[][]> {
  const now = Date.now();
  if (useCache && rowsCache && rowsCache.key === sheetId && (now - rowsCache.ts) < CACHE_TTL_MS) {
    return rowsCache.rows;
  }

  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(
      `${SHEETS_BASE}/${sheetId}/values/${encodeURIComponent(RANGE)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (res.ok) {
      const data = await res.json();
      const rows = data.values || [];
      rowsCache = { key: sheetId, rows, ts: Date.now() };
      return rows;
    }
    const data = await res.json().catch(() => ({}));
    if (res.status === 429 || res.status >= 500) {
      lastErr = new Error(`Sheets API error: ${JSON.stringify(data)}`);
      // serve cache antigo se existir
      if (rowsCache && rowsCache.key === sheetId) return rowsCache.rows;
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
      continue;
    }
    throw new Error(`Sheets API error: ${JSON.stringify(data)}`);
  }
  throw lastErr ?? new Error('Sheets API error: rate limit');
}

// Find sheet row number (1-indexed) for a given logical ID
function findRowNumberById(rows: string[][], id: string): number {
  for (let i = 1; i < rows.length; i++) {
    if ((rows[i]?.[0] || '').trim().toUpperCase() === id.trim().toUpperCase()) {
      return i + 1; // sheet is 1-indexed
    }
  }
  return -1;
}

const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

import { requireAuth } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const authErr = await requireAuth(req, corsHeaders);
  if (authErr) return authErr;

  try {
    const sheetId = Deno.env.get('GOOGLE_SHEET_ID');
    if (!sheetId) throw new Error('GOOGLE_SHEET_ID not configured');

    const accessToken = await getAccessToken();
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const action = pathParts[pathParts.length - 1];
    const isIdAction = action !== 'obras' && action !== '' && action !== undefined;

    if (req.method === 'GET') {
      const rows = await fetchAllRows(sheetId, accessToken);

      if (isIdAction) {
        const rowNum = findRowNumberById(rows, decodeURIComponent(action));
        if (rowNum === -1) {
          return new Response(JSON.stringify({ error: 'Obra não encontrada' }), {
            status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify(rowToObra(rows[rowNum - 1])), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const obras = rows.slice(1).map((row) => rowToObra(row)).filter(o => o.codigoObra);
      return new Response(JSON.stringify(obras), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (req.method === 'POST') {
      const body = await req.json();
      if (shouldEnsureHeader(sheetId)) await ensureHeader(sheetId, accessToken);

      // Resolve construtora code BEFORE writing (dual-write: name + code in same row)
      if (body.construtora && String(body.construtora).trim() && !body.codigoConstrutora) {
        try {
          const supaUrl = Deno.env.get('SUPABASE_URL');
          const supaKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY');
          if (supaUrl && supaKey) {
            const ensureRes = await fetch(`${supaUrl}/functions/v1/construtoras/ensure`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${supaKey}`, apikey: supaKey, 'Content-Type': 'application/json' },
              body: JSON.stringify({ nome: String(body.construtora).trim() }),
            });
            const ensureData = await ensureRes.json().catch(() => ({}));
            if (ensureRes.ok && ensureData?.codigo) body.codigoConstrutora = ensureData.codigo;
          }
        } catch (e) { console.warn('ensure construtora falhou:', e); }
      }

      // Generate next ID if not provided
      const rows = await fetchAllRows(sheetId, accessToken, false);
      const newId = body.codigoObra && String(body.codigoObra).trim()
        ? String(body.codigoObra).trim()
        : generateNextId(rows);
      body.codigoObra = newId;

      const values = [bodyToRow(body)];

      // Write to the explicit next row instead of relying on :append
      const targetRow = rows.length + 1;
      const writeRange = `Obras!A${targetRow}:${LAST_COL}${targetRow}`;

      const res = await fetch(
        `${SHEETS_BASE}/${sheetId}/values/${encodeURIComponent(writeRange)}?valueInputOption=RAW`,
        {
          method: 'PUT',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ values }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(`Sheets API error: ${JSON.stringify(data)}`);
      invalidateRowsCache();

      return new Response(JSON.stringify({ success: true, id: newId, ...body }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (req.method === 'PUT') {
      if (!isIdAction) throw new Error('ID da obra obrigatório');
      const id = decodeURIComponent(action);

      const body = await req.json();
      const rows = await fetchAllRows(sheetId, accessToken);
      const rowNumber = findRowNumberById(rows, id);
      if (rowNumber === -1) throw new Error('Obra não encontrada');

      // Preserve the original ID
      body.codigoObra = id;
      const updateRange = `Obras!A${rowNumber}:${LAST_COL}${rowNumber}`;
      const values = [bodyToRow(body)];

      const res = await fetch(
        `${SHEETS_BASE}/${sheetId}/values/${encodeURIComponent(updateRange)}?valueInputOption=RAW`,
        {
          method: 'PUT',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ values }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(`Sheets API error: ${JSON.stringify(data)}`);
      invalidateRowsCache();

      return new Response(JSON.stringify({ success: true, id, ...body }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (req.method === 'PATCH') {
      if (!isIdAction) throw new Error('ID da obra obrigatório');
      const id = decodeURIComponent(action);

      const { field, value } = await req.json();
      const colIndex = SHEET_HEADERS.indexOf(field);
      if (colIndex === -1) throw new Error('Campo inválido');

      const rows = await fetchAllRows(sheetId, accessToken);
      const rowNumber = findRowNumberById(rows, id);
      if (rowNumber === -1) throw new Error('Obra não encontrada');

      const colLetter = String.fromCharCode(65 + colIndex);
      const updateRange = `Obras!${colLetter}${rowNumber}`;

      const res = await fetch(
        `${SHEETS_BASE}/${sheetId}/values/${encodeURIComponent(updateRange)}?valueInputOption=RAW`,
        {
          method: 'PUT',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ values: [[value]] }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(`Sheets API error: ${JSON.stringify(data)}`);
      invalidateRowsCache();

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
    const isRateLimit = isRateLimitError(message);
    return new Response(
      JSON.stringify(isRateLimit ? rateLimitPayload() : { error: message }),
      {
        status: isRateLimit ? 200 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
