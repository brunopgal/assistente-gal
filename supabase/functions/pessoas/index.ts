// Edge function: Pessoas (contatos relacionados a Construtoras e opcionalmente a Obras)
// Aba "Pessoas" — colunas:
//   A: Codigo Pessoa | B: Codigo Construtora | C: Codigo Obra Atual
//   D: Nome | E: Cargo | F: Whatsapp | G: Email | H: Observações
//   I: Data Cadastro | J: Data Última Atualização

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

const PE_SHEET = 'Pessoas';
const PE_HEADERS = [
  'codigoPessoa', 'codigoConstrutora', 'codigoObraAtual',
  'nome', 'cargo', 'whatsapp', 'email', 'observacoes',
  'dataCadastro', 'dataUltimaAtualizacao',
];
const PE_HEADER_ROW = [
  'Codigo Pessoa', 'Codigo Construtora', 'Codigo Obra Atual',
  'Nome', 'Cargo', 'Whatsapp', 'Email', 'Observações',
  'Data Cadastro', 'Data Última Atualização',
];
const PE_RANGE = `${PE_SHEET}!A:J`;
const PE_LAST_COL = 'J';

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

function rowToObj(row: string[]): Record<string, string> {
  const o: Record<string, string> = {};
  PE_HEADERS.forEach((h, i) => { o[h] = row[i] || ''; });
  return o;
}
function bodyToRow(body: Record<string, string>): string[] {
  return PE_HEADERS.map(h => body[h] ?? '');
}

let rowsCache: { rows: string[][]; ts: number } | null = null;
let ensureCache: number | null = null;
const CACHE_TTL_MS = 60_000;
const METADATA_CACHE_TTL_MS = 10 * 60_000;

function invalidateRowsCache() { rowsCache = null; }
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

async function ensureSheet(sheetId: string, accessToken: string) {
  if (ensureCache && Date.now() - ensureCache < METADATA_CACHE_TTL_MS) return;
  const metaRes = await fetch(
    `${SHEETS_BASE}/${sheetId}?fields=sheets.properties(title,sheetId)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const meta = await metaRes.json();
  if (!metaRes.ok) {
    if (isRateLimitError(JSON.stringify(meta))) return;
    throw new Error(`Sheets meta error: ${JSON.stringify(meta)}`);
  }
  const exists = (meta.sheets || []).some((s: any) => s.properties?.title === PE_SHEET);
  if (!exists) {
    const addRes = await fetch(`${SHEETS_BASE}/${sheetId}:batchUpdate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title: PE_SHEET } } }] }),
    });
    const addData = await addRes.json();
    if (!addRes.ok) throw new Error(`Add sheet error: ${JSON.stringify(addData)}`);
  }
  const checkRes = await fetch(
    `${SHEETS_BASE}/${sheetId}/values/${encodeURIComponent(`${PE_SHEET}!A1:${PE_LAST_COL}1`)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const checkData = await checkRes.json();
  if (!checkRes.ok) {
    if (isRateLimitError(JSON.stringify(checkData))) return;
    throw new Error(`Sheets API error: ${JSON.stringify(checkData)}`);
  }
  if (!checkData.values || checkData.values.length === 0) {
    await fetch(
      `${SHEETS_BASE}/${sheetId}/values/${encodeURIComponent(`${PE_SHEET}!A1:${PE_LAST_COL}1`)}?valueInputOption=RAW`,
      {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [PE_HEADER_ROW] }),
      }
    );
  }
  ensureCache = Date.now();
}

async function fetchRows(sheetId: string, accessToken: string): Promise<string[][]> {
  if (rowsCache && Date.now() - rowsCache.ts < CACHE_TTL_MS) return rowsCache.rows;
  const res = await fetch(
    `${SHEETS_BASE}/${sheetId}/values/${encodeURIComponent(PE_RANGE)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const data = await res.json();
  if (!res.ok) {
    if ((res.status === 429 || res.status >= 500) && rowsCache) return rowsCache.rows;
    throw new Error(`Sheets API error: ${JSON.stringify(data)}`);
  }
  const rows = data.values || [];
  rowsCache = { rows, ts: Date.now() };
  return rows;
}

function generateNextId(rows: string[][]): string {
  let maxNum = 0;
  for (let i = 1; i < rows.length; i++) {
    const id = rows[i]?.[0] || '';
    const m = id.match(/^PE(\d+)$/i);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > maxNum) maxNum = n;
    }
  }
  return `PE${String(maxNum + 1).padStart(9, '0')}`;
}

function findRowByFirstCol(rows: string[][], id: string): number {
  const target = id.trim().toUpperCase();
  for (let i = 1; i < rows.length; i++) {
    if ((rows[i]?.[0] || '').trim().toUpperCase() === target) return i + 1;
  }
  return -1;
}

async function getSheetGid(sheetId: string, accessToken: string): Promise<number> {
  const metaRes = await fetch(
    `${SHEETS_BASE}/${sheetId}?fields=sheets.properties(title,sheetId)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const meta = await metaRes.json();
  if (!metaRes.ok) throw new Error(`Sheets meta error: ${JSON.stringify(meta)}`);
  const sheet = (meta.sheets || []).find((s: any) => s.properties?.title === PE_SHEET);
  if (!sheet) throw new Error(`Aba ${PE_SHEET} não encontrada`);
  return sheet.properties.sheetId;
}

function todayBR(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

import { requireAuth } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const authErr = await requireAuth(req, corsHeaders);
  if (authErr) return authErr;

  try {
    const sheetId = Deno.env.get('GOOGLE_SHEET_ID');
    if (!sheetId) throw new Error('GOOGLE_SHEET_ID not configured');
    const accessToken = await getAccessToken();
    const url = new URL(req.url);

    const parts = url.pathname.split('/').filter(Boolean);
    const idx = parts.findIndex(p => p === 'pessoas');
    const seg1 = idx >= 0 && parts[idx + 1] ? decodeURIComponent(parts[idx + 1]) : '';

    await ensureSheet(sheetId, accessToken);

    if (req.method === 'GET') {
      const rows = await fetchRows(sheetId, accessToken);
      if (seg1) {
        const rowIdx = findRowByFirstCol(rows, seg1);
        if (rowIdx < 0) {
          return new Response(JSON.stringify({ error: 'Pessoa não encontrada' }), {
            status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify(rowToObj(rows[rowIdx - 1])), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const filtroCT = url.searchParams.get('codigoConstrutora');
      const filtroOB = url.searchParams.get('codigoObra');
      let items = rows.slice(1).map(rowToObj).filter(p => p.codigoPessoa);
      if (filtroCT) {
        const f = filtroCT.trim().toUpperCase();
        items = items.filter(p => (p.codigoConstrutora || '').trim().toUpperCase() === f);
      }
      if (filtroOB) {
        const f = filtroOB.trim().toUpperCase();
        items = items.filter(p => (p.codigoObraAtual || '').trim().toUpperCase() === f);
      }
      return new Response(JSON.stringify(items), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (req.method === 'POST') {
      const body = await req.json();
      const rows = await fetchRows(sheetId, accessToken);
      body.codigoPessoa = body.codigoPessoa && String(body.codigoPessoa).trim()
        ? String(body.codigoPessoa).trim()
        : generateNextId(rows);
      if (!body.dataCadastro) body.dataCadastro = todayBR();
      body.dataUltimaAtualizacao = todayBR();

      const targetRow = rows.length + 1;
      const writeRange = `${PE_SHEET}!A${targetRow}:${PE_LAST_COL}${targetRow}`;
      const res = await fetch(
        `${SHEETS_BASE}/${sheetId}/values/${encodeURIComponent(writeRange)}?valueInputOption=RAW`,
        {
          method: 'PUT',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ values: [bodyToRow(body)] }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(`Sheets API error: ${JSON.stringify(data)}`);
      invalidateRowsCache();
      return new Response(JSON.stringify({ success: true, ...body }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (req.method === 'PUT' && seg1) {
      const body = await req.json();
      const rows = await fetchRows(sheetId, accessToken);
      const rowIdx = findRowByFirstCol(rows, seg1);
      if (rowIdx < 0) throw new Error('Pessoa não encontrada');
      const existing = rowToObj(rows[rowIdx - 1]);
      const merged = {
        ...existing,
        ...body,
        codigoPessoa: seg1,
        dataCadastro: existing.dataCadastro || todayBR(),
        dataUltimaAtualizacao: todayBR(),
      };
      const range = `${PE_SHEET}!A${rowIdx}:${PE_LAST_COL}${rowIdx}`;
      const res = await fetch(
        `${SHEETS_BASE}/${sheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
        {
          method: 'PUT',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ values: [bodyToRow(merged)] }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(`Sheets API error: ${JSON.stringify(data)}`);
      invalidateRowsCache();
      return new Response(JSON.stringify({ success: true, ...merged }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (req.method === 'DELETE' && seg1) {
      const rows = await fetchRows(sheetId, accessToken);
      const rowIdx = findRowByFirstCol(rows, seg1);
      if (rowIdx < 0) throw new Error('Pessoa não encontrada');
      const gid = await getSheetGid(sheetId, accessToken);
      await fetch(`${SHEETS_BASE}/${sheetId}:batchUpdate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [{
            deleteDimension: {
              range: { sheetId: gid, dimension: 'ROWS', startIndex: rowIdx - 1, endIndex: rowIdx },
            },
          }],
        }),
      });
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
    return new Response(JSON.stringify(isRateLimit ? rateLimitPayload() : { error: message }), {
      status: isRateLimit ? 200 : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
