// Edge function: Atividades (CRM por obra)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

// Aba Atividades — colunas EXATAS conforme a planilha
// A: ID ATIVIDADE | B: ID | C: Data da atividade | D: Tipo de contato
// E: Status | F: Próximo contato | G: Comentário
const SHEET_HEADERS = [
  'idAtividade',     // A
  'idObra',          // B
  'dataAtividade',   // C
  'tipoContato',     // D
  'status',          // E
  'proximoContato',  // F
  'comentario',      // G
];

const SHEET_HEADER_ROW = [
  'ID ATIVIDADE', 'ID', 'Data da atividade', 'Tipo de contato',
  'Status', 'Próximo contato', 'Comentário',
];

const SHEET_NAME = 'Atividades';
const RANGE = `${SHEET_NAME}!A:G`;
const LAST_COL = 'G';
const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

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

function rowToAtividade(row: string[]): Record<string, string> {
  const a: Record<string, string> = {};
  SHEET_HEADERS.forEach((h, i) => { a[h] = row[i] || ''; });
  return a;
}

function bodyToRow(body: Record<string, string>): string[] {
  return SHEET_HEADERS.map(h => body[h] ?? '');
}

function generateNextId(rows: string[][]): string {
  let maxNum = 0;
  for (let i = 1; i < rows.length; i++) {
    const id = rows[i]?.[0] || '';
    const m = id.match(/^ATIV(\d+)$/i);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > maxNum) maxNum = n;
    }
  }
  return `ATIV${String(maxNum + 1).padStart(6, '0')}`;
}

async function getSheetGid(sheetId: string, accessToken: string): Promise<number> {
  const metaRes = await fetch(
    `${SHEETS_BASE}/${sheetId}?fields=sheets.properties(title,sheetId)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const meta = await metaRes.json();
  if (!metaRes.ok) throw new Error(`Sheets meta error: ${JSON.stringify(meta)}`);
  const sheet = (meta.sheets || []).find((s: any) => s.properties?.title === SHEET_NAME);
  if (!sheet) throw new Error('Aba Atividades não encontrada');
  return sheet.properties.sheetId;
}

async function ensureSheetAndHeader(sheetId: string, accessToken: string) {
  const metaRes = await fetch(
    `${SHEETS_BASE}/${sheetId}?fields=sheets.properties(title,sheetId)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const meta = await metaRes.json();
  if (!metaRes.ok) throw new Error(`Sheets meta error: ${JSON.stringify(meta)}`);
  const sheetExists = (meta.sheets || []).some((s: any) => s.properties?.title === SHEET_NAME);
  if (!sheetExists) {
    const addRes = await fetch(
      `${SHEETS_BASE}/${sheetId}:batchUpdate`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [{ addSheet: { properties: { title: SHEET_NAME } } }],
        }),
      }
    );
    const addData = await addRes.json();
    if (!addRes.ok) throw new Error(`Add sheet error: ${JSON.stringify(addData)}`);
  }

  const checkRes = await fetch(
    `${SHEETS_BASE}/${sheetId}/values/${encodeURIComponent(`${SHEET_NAME}!A1:${LAST_COL}1`)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const checkData = await checkRes.json();
  if (!checkData.values || checkData.values.length === 0) {
    await fetch(
      `${SHEETS_BASE}/${sheetId}/values/${encodeURIComponent(`${SHEET_NAME}!A1:${LAST_COL}1`)}?valueInputOption=RAW`,
      {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [SHEET_HEADER_ROW] }),
      }
    );
  }
}

async function fetchAllRows(sheetId: string, accessToken: string): Promise<string[][]> {
  const res = await fetch(
    `${SHEETS_BASE}/${sheetId}/values/${encodeURIComponent(RANGE)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(`Sheets API error: ${JSON.stringify(data)}`);
  return data.values || [];
}

function findRowIndexByAtividadeId(rows: string[][], idAtividade: string): number {
  // returns 1-based row index in the sheet (row 1 is header)
  const target = idAtividade.trim().toUpperCase();
  for (let i = 1; i < rows.length; i++) {
    const id = (rows[i]?.[0] || '').trim().toUpperCase();
    if (id === target) return i + 1; // sheet rows are 1-based
  }
  return -1;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const sheetId = Deno.env.get('GOOGLE_SHEET_ID');
    if (!sheetId) throw new Error('GOOGLE_SHEET_ID not configured');

    const accessToken = await getAccessToken();
    const url = new URL(req.url);

    // Path: /functions/v1/atividades OR /functions/v1/atividades/<idAtividade>
    const pathParts = url.pathname.split('/').filter(Boolean);
    const idxAtividades = pathParts.findIndex((p) => p === 'atividades');
    const pathId = idxAtividades >= 0 && pathParts[idxAtividades + 1]
      ? decodeURIComponent(pathParts[idxAtividades + 1])
      : '';

    const obraIdFilter = url.searchParams.get('idObra');

    await ensureSheetAndHeader(sheetId, accessToken);

    if (req.method === 'GET') {
      const rows = await fetchAllRows(sheetId, accessToken);
      let atividades = rows.slice(1).map(rowToAtividade).filter(a => a.idAtividade);
      if (obraIdFilter) {
        const f = obraIdFilter.trim().toUpperCase();
        atividades = atividades.filter(a => (a.idObra || '').trim().toUpperCase() === f);
      }
      return new Response(JSON.stringify(atividades), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (req.method === 'POST') {
      const body = await req.json();
      if (!body.idObra || !String(body.idObra).trim()) {
        throw new Error('ID da obra obrigatório (idObra)');
      }

      const rows = await fetchAllRows(sheetId, accessToken);
      const newId = body.idAtividade && String(body.idAtividade).trim()
        ? String(body.idAtividade).trim()
        : generateNextId(rows);
      body.idAtividade = newId;

      if (!body.dataAtividade) {
        const d = new Date();
        body.dataAtividade = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
      }

      const values = [bodyToRow(body)];
      const res = await fetch(
        `${SHEETS_BASE}/${sheetId}/values/${encodeURIComponent(RANGE)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ values }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(`Sheets API error: ${JSON.stringify(data)}`);

      return new Response(JSON.stringify({ success: true, ...body }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (req.method === 'PUT') {
      if (!pathId) throw new Error('ID da atividade obrigatório no path');
      const body = await req.json();
      const rows = await fetchAllRows(sheetId, accessToken);
      const rowIdx = findRowIndexByAtividadeId(rows, pathId);
      if (rowIdx < 0) throw new Error(`Atividade ${pathId} não encontrada`);

      const existing = rowToAtividade(rows[rowIdx - 1]);
      const merged: Record<string, string> = { ...existing, ...body, idAtividade: pathId };

      const range = `${SHEET_NAME}!A${rowIdx}:${LAST_COL}${rowIdx}`;
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

      return new Response(JSON.stringify({ success: true, ...merged }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (req.method === 'DELETE') {
      if (!pathId) throw new Error('ID da atividade obrigatório no path');
      const rows = await fetchAllRows(sheetId, accessToken);
      const rowIdx = findRowIndexByAtividadeId(rows, pathId);
      if (rowIdx < 0) throw new Error(`Atividade ${pathId} não encontrada`);

      const gid = await getSheetGid(sheetId, accessToken);
      const res = await fetch(
        `${SHEETS_BASE}/${sheetId}:batchUpdate`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requests: [{
              deleteDimension: {
                range: {
                  sheetId: gid,
                  dimension: 'ROWS',
                  startIndex: rowIdx - 1, // 0-based inclusive
                  endIndex: rowIdx,       // exclusive
                },
              },
            }],
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(`Sheets API error: ${JSON.stringify(data)}`);

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
