// Edge function: Construtoras + Atividades Construtoras (atividades + visitas/reuniões na mesma aba)
// Aba "Construtoras" — colunas:
//   A: Codigo Construtora | B: Nome | C: CNPJ | D: Produto | E: Status | F: Observações
// Aba "Atividades Construtoras" — colunas:
//   A: ID Atividade | B: Codigo Construtora | C: Tipo Registro (atividade/visita/reuniao)
//   D: Data | E: Horário | F: Tipo de contato | G: Status | H: Próximo contato | I: Comentário

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

// ===== Construtoras =====
const CT_SHEET = 'Construtoras';
const CT_HEADERS = ['codigo', 'nome', 'cnpj', 'produto', 'status', 'observacoes'];
const CT_HEADER_ROW = ['Codigo Construtora', 'Nome', 'CNPJ', 'Produto', 'Status', 'Observações'];
const CT_RANGE = `${CT_SHEET}!A:F`;
const CT_LAST_COL = 'F';

// ===== Atividades Construtoras =====
const AT_SHEET = 'Atividades Construtoras';
const AT_HEADERS = [
  'idAtividade', 'codigoConstrutora', 'tipoRegistro',
  'data', 'horario', 'tipoContato', 'status', 'proximoContato', 'comentario',
];
const AT_HEADER_ROW = [
  'ID Atividade', 'Codigo Construtora', 'Tipo Registro',
  'Data', 'Horário', 'Tipo de contato', 'Status', 'Próximo contato', 'Comentário',
];
const AT_RANGE = `${AT_SHEET}!A:I`;
const AT_LAST_COL = 'I';

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

function rowToObj(row: string[], headers: string[]): Record<string, string> {
  const o: Record<string, string> = {};
  headers.forEach((h, i) => { o[h] = row[i] || ''; });
  return o;
}
function bodyToRow(body: Record<string, string>, headers: string[]): string[] {
  return headers.map(h => body[h] ?? '');
}

async function ensureSheet(sheetId: string, accessToken: string, name: string, lastCol: string, headerRow: string[]) {
  const metaRes = await fetch(
    `${SHEETS_BASE}/${sheetId}?fields=sheets.properties(title,sheetId)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const meta = await metaRes.json();
  if (!metaRes.ok) throw new Error(`Sheets meta error: ${JSON.stringify(meta)}`);
  const exists = (meta.sheets || []).some((s: any) => s.properties?.title === name);
  if (!exists) {
    const addRes = await fetch(`${SHEETS_BASE}/${sheetId}:batchUpdate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title: name } } }] }),
    });
    const addData = await addRes.json();
    if (!addRes.ok) throw new Error(`Add sheet error: ${JSON.stringify(addData)}`);
  }
  const checkRes = await fetch(
    `${SHEETS_BASE}/${sheetId}/values/${encodeURIComponent(`${name}!A1:${lastCol}1`)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const checkData = await checkRes.json();
  if (!checkData.values || checkData.values.length === 0) {
    await fetch(
      `${SHEETS_BASE}/${sheetId}/values/${encodeURIComponent(`${name}!A1:${lastCol}1`)}?valueInputOption=RAW`,
      {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [headerRow] }),
      }
    );
  }
}

async function fetchRows(sheetId: string, accessToken: string, range: string): Promise<string[][]> {
  const res = await fetch(
    `${SHEETS_BASE}/${sheetId}/values/${encodeURIComponent(range)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(`Sheets API error: ${JSON.stringify(data)}`);
  return data.values || [];
}

function generateNextId(rows: string[][], prefix: string, padLen: number): string {
  let maxNum = 0;
  const re = new RegExp(`^${prefix}(\\d+)$`, 'i');
  for (let i = 1; i < rows.length; i++) {
    const id = rows[i]?.[0] || '';
    const m = id.match(re);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > maxNum) maxNum = n;
    }
  }
  return `${prefix}${String(maxNum + 1).padStart(padLen, '0')}`;
}

function findRowByFirstCol(rows: string[][], id: string): number {
  const target = id.trim().toUpperCase();
  for (let i = 1; i < rows.length; i++) {
    if ((rows[i]?.[0] || '').trim().toUpperCase() === target) return i + 1;
  }
  return -1;
}

async function getSheetGid(sheetId: string, accessToken: string, name: string): Promise<number> {
  const metaRes = await fetch(
    `${SHEETS_BASE}/${sheetId}?fields=sheets.properties(title,sheetId)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const meta = await metaRes.json();
  const sheet = (meta.sheets || []).find((s: any) => s.properties?.title === name);
  if (!sheet) throw new Error(`Aba ${name} não encontrada`);
  return sheet.properties.sheetId;
}

// ===== Helpers compartilhados (usados por sync) =====
const OBRAS_RANGE = 'Obras!A:X';
const ATIVIDADES_RANGE = 'Atividades!A:G';

function normalizeName(s: string): string {
  return (s || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

async function findOrCreateConstrutoraByName(
  sheetId: string,
  accessToken: string,
  nome: string,
  ctRows: string[][],
): Promise<{ codigo: string; rows: string[][] }> {
  const target = normalizeName(nome);
  if (!target) return { codigo: '', rows: ctRows };
  for (let i = 1; i < ctRows.length; i++) {
    const r = ctRows[i];
    if (normalizeName(r?.[1] || '') === target) {
      return { codigo: (r?.[0] || '').trim(), rows: ctRows };
    }
  }
  const codigo = generateNextId(ctRows, 'CT', 9);
  const newRow = [codigo, nome.trim(), '', '', 'Prospecção', ''];
  const targetRow = ctRows.length + 1;
  const writeRange = `${CT_SHEET}!A${targetRow}:${CT_LAST_COL}${targetRow}`;
  await fetch(
    `${SHEETS_BASE}/${sheetId}/values/${encodeURIComponent(writeRange)}?valueInputOption=RAW`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [newRow] }),
    }
  );
  const updated = [...ctRows, newRow];
  return { codigo, rows: updated };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const sheetId = Deno.env.get('GOOGLE_SHEET_ID');
    if (!sheetId) throw new Error('GOOGLE_SHEET_ID not configured');
    const accessToken = await getAccessToken();
    const url = new URL(req.url);

    // path: /functions/v1/construtoras[/<resource>[/<id>]]
    const parts = url.pathname.split('/').filter(Boolean);
    const idx = parts.findIndex(p => p === 'construtoras');
    const seg1 = idx >= 0 && parts[idx + 1] ? decodeURIComponent(parts[idx + 1]) : '';
    const seg2 = idx >= 0 && parts[idx + 2] ? decodeURIComponent(parts[idx + 2]) : '';

    // ============ ROTA: /construtoras/sync-construtoras ============
    if (seg1 === 'sync-construtoras' && req.method === 'POST') {
      await ensureSheet(sheetId, accessToken, CT_SHEET, CT_LAST_COL, CT_HEADER_ROW);
      const obrasRows = await fetchRows(sheetId, accessToken, OBRAS_RANGE);
      let ctRows = await fetchRows(sheetId, accessToken, CT_RANGE);
      // unique constructor names from Obras (column F = index 5)
      const seen = new Set<string>();
      const nomes: string[] = [];
      for (let i = 1; i < obrasRows.length; i++) {
        const nome = (obrasRows[i]?.[5] || '').trim();
        if (!nome) continue;
        const k = normalizeName(nome);
        if (seen.has(k)) continue;
        seen.add(k);
        nomes.push(nome);
      }
      let criadas = 0;
      for (const nome of nomes) {
        const before = ctRows.length;
        const r = await findOrCreateConstrutoraByName(sheetId, accessToken, nome, ctRows);
        ctRows = r.rows;
        if (ctRows.length > before) criadas++;
      }
      return new Response(JSON.stringify({ success: true, criadas, total: nomes.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ============ ROTA: /construtoras/sync-atividades ============
    if (seg1 === 'sync-atividades' && req.method === 'POST') {
      await ensureSheet(sheetId, accessToken, CT_SHEET, CT_LAST_COL, CT_HEADER_ROW);
      await ensureSheet(sheetId, accessToken, AT_SHEET, AT_LAST_COL, AT_HEADER_ROW);

      const obrasRows = await fetchRows(sheetId, accessToken, OBRAS_RANGE);
      const atvRows = await fetchRows(sheetId, accessToken, ATIVIDADES_RANGE);
      let ctRows = await fetchRows(sheetId, accessToken, CT_RANGE);
      let atcRows = await fetchRows(sheetId, accessToken, AT_RANGE);

      // Map obra ID -> { nome, construtora }
      const obraMap = new Map<string, { nome: string; construtora: string }>();
      for (let i = 1; i < obrasRows.length; i++) {
        const r = obrasRows[i] || [];
        const id = (r[0] || '').trim().toUpperCase();
        if (!id) continue;
        obraMap.set(id, { nome: (r[3] || '').trim(), construtora: (r[5] || '').trim() });
      }

      // Already mirrored: detect [ORIG:<idAtividade>] in column I (comentario, index 8)
      const mirrored = new Set<string>();
      for (let i = 1; i < atcRows.length; i++) {
        const c = atcRows[i]?.[8] || '';
        const m = c.match(/\[ORIG:([A-Z0-9]+)\]/i);
        if (m) mirrored.add(m[1].toUpperCase());
      }

      let espelhadas = 0;
      const novasLinhas: string[][] = [];
      for (let i = 1; i < atvRows.length; i++) {
        const r = atvRows[i] || [];
        const idAtv = (r[0] || '').trim();
        if (!idAtv) continue;
        if (mirrored.has(idAtv.toUpperCase())) continue;
        const idObra = (r[1] || '').trim().toUpperCase();
        const meta = obraMap.get(idObra);
        if (!meta || !meta.construtora) continue;

        const found = await findOrCreateConstrutoraByName(sheetId, accessToken, meta.construtora, ctRows);
        ctRows = found.rows;
        const codigoCT = found.codigo;
        if (!codigoCT) continue;

        const novoId = generateNextId([...atcRows, ...novasLinhas], 'ATC', 6);
        const comentarioOrig = r[6] || '';
        const novoComentario = `[ORIG:${idAtv}] Obra: ${meta.nome} — ${comentarioOrig}`;
        const novaLinha = [
          novoId, codigoCT, 'atividade',
          r[2] || '', '', r[3] || '', r[4] || '', r[5] || '', novoComentario,
        ];
        novasLinhas.push(novaLinha);
        mirrored.add(idAtv.toUpperCase());
        espelhadas++;
      }

      if (novasLinhas.length > 0) {
        // Append in batch
        const startRow = atcRows.length + 1;
        const endRow = startRow + novasLinhas.length - 1;
        const writeRange = `${AT_SHEET}!A${startRow}:${AT_LAST_COL}${endRow}`;
        const res = await fetch(
          `${SHEETS_BASE}/${sheetId}/values/${encodeURIComponent(writeRange)}?valueInputOption=RAW`,
          {
            method: 'PUT',
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ values: novasLinhas }),
          }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(`Sheets API error: ${JSON.stringify(data)}`);
      }

      return new Response(JSON.stringify({ success: true, espelhadas }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ============ ROTA: /construtoras/ensure (interna) — garante construtora por nome ============
    if (seg1 === 'ensure' && req.method === 'POST') {
      await ensureSheet(sheetId, accessToken, CT_SHEET, CT_LAST_COL, CT_HEADER_ROW);
      const body = await req.json();
      const nome = String(body?.nome || '').trim();
      if (!nome) throw new Error('nome obrigatório');
      const ctRows = await fetchRows(sheetId, accessToken, CT_RANGE);
      const r = await findOrCreateConstrutoraByName(sheetId, accessToken, nome, ctRows);
      return new Response(JSON.stringify({ success: true, codigo: r.codigo }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ============ ROTA: /construtoras/mirror-atividade (interna) — espelha 1 atividade ============
    if (seg1 === 'mirror-atividade' && req.method === 'POST') {
      await ensureSheet(sheetId, accessToken, CT_SHEET, CT_LAST_COL, CT_HEADER_ROW);
      await ensureSheet(sheetId, accessToken, AT_SHEET, AT_LAST_COL, AT_HEADER_ROW);
      const body = await req.json();
      const { idAtividade, nomeObra, construtora, dataAtividade, tipoContato, status, proximoContato, comentario } = body || {};
      if (!idAtividade || !construtora) throw new Error('idAtividade e construtora obrigatórios');

      let ctRows = await fetchRows(sheetId, accessToken, CT_RANGE);
      const found = await findOrCreateConstrutoraByName(sheetId, accessToken, construtora, ctRows);
      const codigoCT = found.codigo;
      if (!codigoCT) throw new Error('falha ao obter código da construtora');

      const atcRows = await fetchRows(sheetId, accessToken, AT_RANGE);
      // dedupe
      for (let i = 1; i < atcRows.length; i++) {
        const c = atcRows[i]?.[8] || '';
        if (c.includes(`[ORIG:${idAtividade}]`)) {
          return new Response(JSON.stringify({ success: true, skipped: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
      const novoId = generateNextId(atcRows, 'ATC', 6);
      const novoComentario = `[ORIG:${idAtividade}] Obra: ${nomeObra || ''} — ${comentario || ''}`;
      const targetRow = atcRows.length + 1;
      const writeRange = `${AT_SHEET}!A${targetRow}:${AT_LAST_COL}${targetRow}`;
      await fetch(
        `${SHEETS_BASE}/${sheetId}/values/${encodeURIComponent(writeRange)}?valueInputOption=RAW`,
        {
          method: 'PUT',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            values: [[novoId, codigoCT, 'atividade', dataAtividade || '', '', tipoContato || '', status || '', proximoContato || '', novoComentario]],
          }),
        }
      );
      return new Response(JSON.stringify({ success: true, idAtividade: novoId, codigoCT }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ============ ROTA: /construtoras/atividades ============
    if (seg1 === 'atividades') {
      await ensureSheet(sheetId, accessToken, AT_SHEET, AT_LAST_COL, AT_HEADER_ROW);

      if (req.method === 'GET') {
        const rows = await fetchRows(sheetId, accessToken, AT_RANGE);
        const filtroCodigo = url.searchParams.get('codigo');
        let items = rows.slice(1).map(r => rowToObj(r, AT_HEADERS)).filter(a => a.idAtividade);
        if (filtroCodigo) {
          const f = filtroCodigo.trim().toUpperCase();
          items = items.filter(a => (a.codigoConstrutora || '').trim().toUpperCase() === f);
        }
        return new Response(JSON.stringify(items), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (req.method === 'POST') {
        const body = await req.json();
        if (!body.codigoConstrutora) throw new Error('codigoConstrutora obrigatório');
        const rows = await fetchRows(sheetId, accessToken, AT_RANGE);
        body.idAtividade = body.idAtividade || generateNextId(rows, 'ATC', 6);
        if (!body.tipoRegistro) body.tipoRegistro = 'atividade';
        if (!body.data) {
          const d = new Date();
          body.data = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
        }
        const targetRow = rows.length + 1;
        const writeRange = `${AT_SHEET}!A${targetRow}:${AT_LAST_COL}${targetRow}`;
        const res = await fetch(
          `${SHEETS_BASE}/${sheetId}/values/${encodeURIComponent(writeRange)}?valueInputOption=RAW`,
          {
            method: 'PUT',
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ values: [bodyToRow(body, AT_HEADERS)] }),
          }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(`Sheets API error: ${JSON.stringify(data)}`);
        return new Response(JSON.stringify({ success: true, ...body }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (req.method === 'DELETE') {
        if (!seg2) throw new Error('idAtividade obrigatório no path');
        const rows = await fetchRows(sheetId, accessToken, AT_RANGE);
        const rowIdx = findRowByFirstCol(rows, seg2);
        if (rowIdx < 0) throw new Error('Atividade não encontrada');
        const gid = await getSheetGid(sheetId, accessToken, AT_SHEET);
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
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (req.method === 'PUT') {
        if (!seg2) throw new Error('idAtividade obrigatório no path');
        const body = await req.json();
        const rows = await fetchRows(sheetId, accessToken, AT_RANGE);
        const rowIdx = findRowByFirstCol(rows, seg2);
        if (rowIdx < 0) throw new Error('Atividade não encontrada');
        const existing = rowToObj(rows[rowIdx - 1], AT_HEADERS);
        const merged = { ...existing, ...body, idAtividade: seg2 };
        const range = `${AT_SHEET}!A${rowIdx}:${AT_LAST_COL}${rowIdx}`;
        const res = await fetch(
          `${SHEETS_BASE}/${sheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
          {
            method: 'PUT',
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ values: [bodyToRow(merged, AT_HEADERS)] }),
          }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(`Sheets API error: ${JSON.stringify(data)}`);
        return new Response(JSON.stringify({ success: true, ...merged }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // ============ ROTA: /construtoras (CRUD construtoras) ============
    await ensureSheet(sheetId, accessToken, CT_SHEET, CT_LAST_COL, CT_HEADER_ROW);

    if (req.method === 'GET') {
      const rows = await fetchRows(sheetId, accessToken, CT_RANGE);
      if (seg1) {
        const rowIdx = findRowByFirstCol(rows, seg1);
        if (rowIdx < 0) {
          return new Response(JSON.stringify({ error: 'Construtora não encontrada' }), {
            status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify(rowToObj(rows[rowIdx - 1], CT_HEADERS)), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const items = rows.slice(1).map(r => rowToObj(r, CT_HEADERS)).filter(c => c.codigo);
      return new Response(JSON.stringify(items), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (req.method === 'POST') {
      const body = await req.json();
      const rows = await fetchRows(sheetId, accessToken, CT_RANGE);
      body.codigo = body.codigo && String(body.codigo).trim()
        ? String(body.codigo).trim()
        : generateNextId(rows, 'CT', 9);
      const targetRow = rows.length + 1;
      const writeRange = `${CT_SHEET}!A${targetRow}:${CT_LAST_COL}${targetRow}`;
      const res = await fetch(
        `${SHEETS_BASE}/${sheetId}/values/${encodeURIComponent(writeRange)}?valueInputOption=RAW`,
        {
          method: 'PUT',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ values: [bodyToRow(body, CT_HEADERS)] }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(`Sheets API error: ${JSON.stringify(data)}`);
      return new Response(JSON.stringify({ success: true, ...body }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (req.method === 'PUT' && seg1) {
      const body = await req.json();
      const rows = await fetchRows(sheetId, accessToken, CT_RANGE);
      const rowIdx = findRowByFirstCol(rows, seg1);
      if (rowIdx < 0) throw new Error('Construtora não encontrada');
      const existing = rowToObj(rows[rowIdx - 1], CT_HEADERS);
      const merged = { ...existing, ...body, codigo: seg1 };
      const range = `${CT_SHEET}!A${rowIdx}:${CT_LAST_COL}${rowIdx}`;
      const res = await fetch(
        `${SHEETS_BASE}/${sheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
        {
          method: 'PUT',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ values: [bodyToRow(merged, CT_HEADERS)] }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(`Sheets API error: ${JSON.stringify(data)}`);
      return new Response(JSON.stringify({ success: true, ...merged }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (req.method === 'DELETE' && seg1) {
      const rows = await fetchRows(sheetId, accessToken, CT_RANGE);
      const rowIdx = findRowByFirstCol(rows, seg1);
      if (rowIdx < 0) throw new Error('Construtora não encontrada');
      const gid = await getSheetGid(sheetId, accessToken, CT_SHEET);
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
