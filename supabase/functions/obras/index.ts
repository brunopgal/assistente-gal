const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SHEET_HEADERS = [
  'dataCadastro', 'statusProspeccao', 'nome', 'classificacao', 'construtora',
  'responsavel', 'telefone', 'email', 'cidade', 'localizacao',
  'produtoOferecido', 'estagioObra', 'marcouReuniao', 'visita', 'dataUltimaVisita',
  'dataOrcamentoEnviado', 'proximoContato', 'linkOrcamentoRhoden', 'linkOrcamentoPrado',
  'linkOrcamentoImab', 'observacoes', 'concorrentes',
];

const SHEET_HEADER_ROW = [
  'Data de Cadastro', 'Status da Prospecção', 'Nome da Obra', 'Classificação da Obra',
  'Construtora/Cliente', 'Responsável/Contato', 'Telefone/WhatsApp', 'Email',
  'Cidade Obra', 'Localização/Bairro Obra', 'Produto Oferecido', 'Estágio da Obra',
  'Marcou Reunião?', 'Visita', 'Data da Última Visita', 'Data Orçamento Enviado',
  'Próximo Contato/Follow Up', 'Link Orçamento RHODEN', 'Link Orçamento PRADO',
  'Link Orçamento IMAB', 'Observações', 'Concorrentes',
];

const COL_COUNT = SHEET_HEADERS.length; // 22 columns: A-V

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

function rowToObra(row: string[], idx: number): Record<string, string> {
  const obra: Record<string, string> = { id: String(idx) };
  SHEET_HEADERS.forEach((h, i) => { obra[h] = row[i] || ''; });
  return obra;
}

function bodyToRow(body: Record<string, string>): string[] {
  return SHEET_HEADERS.map(h => body[h] || '');
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
    const range = `Obras!A:V`;

    if (req.method === 'GET') {
      const res = await fetch(
        `${SHEETS_BASE}/${sheetId}/values/${encodeURIComponent(range)}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(`Sheets API error: ${JSON.stringify(data)}`);

      const rows = data.values || [];

      if (action !== 'obras' && !isNaN(Number(action))) {
        const rowIdx = Number(action);
        const row = rows[rowIdx];
        if (!row) {
          return new Response(JSON.stringify({ error: 'Obra não encontrada' }), {
            status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify(rowToObra(row, rowIdx)), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const obras = rows.slice(1).map((row: string[], idx: number) => rowToObra(row, idx + 1));
      return new Response(JSON.stringify(obras), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (req.method === 'POST') {
      const body = await req.json();
      const values = [bodyToRow(body)];

      // Ensure header row exists
      const checkRes = await fetch(
        `${SHEETS_BASE}/${sheetId}/values/${encodeURIComponent('Obras!A1:V1')}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const checkData = await checkRes.json();
      if (!checkData.values || checkData.values.length === 0) {
        await fetch(
          `${SHEETS_BASE}/${sheetId}/values/${encodeURIComponent('Obras!A1:V1')}?valueInputOption=RAW`,
          {
            method: 'PUT',
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ values: [SHEET_HEADER_ROW] }),
          }
        );
      }

      const res = await fetch(
        `${SHEETS_BASE}/${sheetId}/values/${encodeURIComponent('Obras!A:V')}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
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
      const rowIdx = Number(action);
      if (isNaN(rowIdx)) throw new Error('ID da obra inválido');

      const body = await req.json();
      const rowNumber = rowIdx + 1;
      const updateRange = `Obras!A${rowNumber}:V${rowNumber}`;
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

      return new Response(JSON.stringify({ success: true, id: String(rowIdx), ...body }), {
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
