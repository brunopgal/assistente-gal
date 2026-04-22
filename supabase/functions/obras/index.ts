const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

// EXACT mapping matching the real Google Sheet structure (A..X = 24 columns)
// IMPORTANT: column J is intentionally empty in the real sheet (gap between Email and Cidade Obra)
const SHEET_HEADERS = [
  'codigoObra',          // A - ID
  'dataCadastro',        // B - Data de cadastro
  'statusProspeccao',    // C - Status da prospecção
  'nome',                // D - Nome da obra
  'classificacao',       // E - Classificação da obra
  'construtora',         // F - Construtora/Cliente
  'responsavel',         // G - Responsável/Contato
  'telefone',            // H - Telefone/Whastapp
  'email',               // I - Email
  '_empty',              // J - (empty column in sheet)
  'cidade',              // K - Cidade Obra
  'localizacao',         // L - Localização/Bairro Obra
  'produtoOferecido',    // M - Produto Oferecido
  'estagioObra',         // N - Estágio da obra
  'marcouReuniao',       // O - Marcou Reunião?
  'visita',              // P - Visita
  'dataUltimaVisita',    // Q - Data da última visita
  'dataOrcamentoEnviado',// R - Data orçamento enviado
  'proximoContato',      // S - Próximo contato/Follow up
  'linkOrcamentoRhoden', // T - Link do orçamento/PDF RHODEN
  'linkOrcamentoPrado',  // U - Link do orçamento/PDF PRADO
  'linkOrcamentoImab',   // V - Link do orçamento/PDF IMAB
  'observacoes',         // W - Observação
  'concorrentes',        // X - Concorrentes
];

const SHEET_HEADER_ROW = [
  'ID', 'Data de cadastro', 'Status da prospecção', 'Nome da obra',
  'Classificação da obra', 'Construtora/Cliente', 'Responsável/Contato',
  'Telefone/Whastapp', 'Email', '', 'Cidade Obra', 'Localização/Bairro Obra',
  'Produto Oferecido', 'Estágio da obra', 'Marcou Reunião?', 'Visita',
  'Data da última visita', 'Data orçamento enviado', 'Próximo contato/Follow up',
  'Link do orçamento/PDF  RHODEN', 'Link do orçamento/PDF  PRADO',
  'Link do orçamento/PDF  IMAB', 'Observação', 'Concorrentes',
];

const RANGE = 'Obras!A:X';
const LAST_COL = 'X';

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

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
      await ensureHeader(sheetId, accessToken);

      // Generate next ID if not provided
      const rows = await fetchAllRows(sheetId, accessToken);
      const newId = body.codigoObra && String(body.codigoObra).trim()
        ? String(body.codigoObra).trim()
        : generateNextId(rows);
      body.codigoObra = newId;

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
