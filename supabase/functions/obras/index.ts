const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function getAccessToken(): Promise<string> {
  const email = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_EMAIL')!;
  let rawKey = Deno.env.get('GOOGLE_PRIVATE_KEY')!;

  // Normalize the private key - handle various escaping scenarios
  // Replace literal \n with actual newlines
  rawKey = rawKey.replace(/\\n/g, '\n');
  // Ensure proper PEM format
  rawKey = rawKey.trim();

  const now = Math.floor(Date.now() / 1000);

  // Create JWT header and payload
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
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };

  const headerB64 = b64url(enc.encode(JSON.stringify(header)));
  const payloadB64 = b64url(enc.encode(JSON.stringify(payload)));
  const signingInput = `${headerB64}.${payloadB64}`;

  // Extract and decode PEM body
  const pemLines = rawKey.split('\n').filter(line => 
    line.trim() !== '' && 
    !line.includes('BEGIN PRIVATE KEY') && 
    !line.includes('END PRIVATE KEY')
  );
  const pemBody = pemLines.join('');
  
  console.log('PEM body length:', pemBody.length);
  console.log('PEM body first 20 chars:', pemBody.substring(0, 20));
  
  const binaryStr = atob(pemBody);
  const binaryKey = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    binaryKey[i] = binaryStr.charCodeAt(i);
  }

  console.log('Binary key length:', binaryKey.length);
  console.log('First 4 bytes:', Array.from(binaryKey.slice(0, 4)).map(b => b.toString(16)));

  const key = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    enc.encode(signingInput)
  );

  const jwt = `${signingInput}.${b64url(signature)}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenRes.json();
  if (!tokenRes.ok) {
    console.error('Token exchange error:', JSON.stringify(tokenData));
    throw new Error(`Token error: ${JSON.stringify(tokenData)}`);
  }
  return tokenData.access_token;
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

    if (req.method === 'GET') {
      const range = 'Obras!A:H';
      const res = await fetch(
        `${SHEETS_BASE}/${sheetId}/values/${encodeURIComponent(range)}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(`Sheets API error: ${JSON.stringify(data)}`);

      const rows = data.values || [];
      const headers = rows[0] || ['nome', 'construtora', 'cidade', 'status', 'responsavel', 'dataContato', 'observacoes'];

      if (action !== 'obras' && !isNaN(Number(action))) {
        const rowIdx = Number(action);
        const row = rows[rowIdx];
        if (!row) {
          return new Response(JSON.stringify({ error: 'Obra não encontrada' }), {
            status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const obra: Record<string, string> = { id: String(rowIdx) };
        headers.forEach((h: string, i: number) => { obra[h] = row[i] || ''; });
        return new Response(JSON.stringify(obra), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const obras = rows.slice(1).map((row: string[], idx: number) => {
        const obra: Record<string, string> = { id: String(idx + 1) };
        headers.forEach((h: string, i: number) => { obra[h] = row[i] || ''; });
        return obra;
      });

      return new Response(JSON.stringify(obras), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (req.method === 'POST') {
      const body = await req.json();
      const values = [[
        body.nome || '', body.construtora || '', body.cidade || '',
        body.status || '', body.responsavel || '', body.dataContato || '',
        body.observacoes || '',
      ]];

      // Ensure header row exists
      const checkRes = await fetch(
        `${SHEETS_BASE}/${sheetId}/values/${encodeURIComponent('Obras!A1:G1')}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const checkData = await checkRes.json();
      if (!checkData.values || checkData.values.length === 0) {
        await fetch(
          `${SHEETS_BASE}/${sheetId}/values/${encodeURIComponent('Obras!A1:G1')}?valueInputOption=RAW`,
          {
            method: 'PUT',
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ values: [['nome', 'construtora', 'cidade', 'status', 'responsavel', 'dataContato', 'observacoes']] }),
          }
        );
      }

      const res = await fetch(
        `${SHEETS_BASE}/${sheetId}/values/${encodeURIComponent('Obras!A:G')}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
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
      const range = `Obras!A${rowNumber}:G${rowNumber}`;
      const values = [[
        body.nome || '', body.construtora || '', body.cidade || '',
        body.status || '', body.responsavel || '', body.dataContato || '',
        body.observacoes || '',
      ]];

      const res = await fetch(
        `${SHEETS_BASE}/${sheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
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
