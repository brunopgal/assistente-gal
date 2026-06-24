// Geocodificação compartilhada (Nominatim/OpenStreetMap) + persistência em obras_coordenadas.
// Usada pela edge function `obras` para geocodificar no momento do cadastro/edição.
//
// Regra crítica: distinguimos "não encontrado" (resposta vazia da API -> grava not_found=true)
// de erro de requisição (rede/HTTP -> NÃO grava nada; uma falha transitória não pode virar
// um "endereço inexistente" permanente). Pendências são resolvidas pelo backfill do Mapa.

export type GeocodeResult =
  | { status: 'ok'; lat: number; lng: number }
  | { status: 'not_found' }
  | { status: 'error' };

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
// Server-side podemos enviar um User-Agent real, como pede a política do Nominatim.
const USER_AGENT = 'AssistenteGal/1.0 (CRM de obras; contato: brunopgal@gmail.com)';

// Espelha src/lib/normalize.ts do frontend — as chaves PRECISAM coincidir.
export function normalizeText(s: unknown): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

function isUrl(s: string): boolean {
  return /^https?:\/\//i.test((s || '').trim());
}

export function cleanEnderecoParaGeocode(loc: string): string {
  if (!loc) return "";
  
  // corta tudo a partir do primeiro " - " (descarta bairro/CEP)
  let clean = loc.split(" - ")[0];
  
  // remove "CEP 00000-000", "nº"/"n°", "s/nº"
  clean = clean.replace(/cep\s*:?\s*\d{5}-?\d{3}/gi, "");
  clean = clean.replace(/\b\d{5}-?\d{3}\b/g, "");
  clean = clean.replace(/\bcep\b/gi, "");
  clean = clean.replace(/s\/n[º°]?/gi, "");
  clean = clean.replace(/n[º°]/gi, "");
  
  // normaliza espaços e vírgulas
  clean = clean.replace(/,+/g, ",");
  clean = clean.replace(/\s*,\s*/g, ", ");
  clean = clean.replace(/\s+/g, " ");
  
  // remove vírgulas ou espaços no início e fim
  clean = clean.trim()
    .replace(/^,+/, "")
    .replace(/,+$/, "")
    .trim();
    
  return clean;
}

// Monta a query de geocodificação a partir da obra (mesma regra do Mapa.tsx):
// usa `localizacao` somente quando é texto (nunca URL) e junta com a cidade.
export function buildObraQuery(obra: { localizacao?: string; cidade?: string }): string {
  const locTxt = isUrl(obra.localizacao || '') ? '' : (obra.localizacao || '').trim();
  const logradouro = cleanEnderecoParaGeocode(locTxt);
  const cidade = (obra.cidade || '').trim();
  
  if (!logradouro && !cidade) {
    return "";
  }
  
  return [logradouro, cidade, 'Brasil'].filter(Boolean).join(', ');
}

export async function geocodeQuery(query: string): Promise<GeocodeResult> {
  try {
    const res = await fetch(
      `${NOMINATIM_URL}?format=json&q=${encodeURIComponent(query)}&limit=1`,
      { headers: { 'User-Agent': USER_AGENT } },
    );
    if (!res.ok) return { status: 'error' };
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      const lat = parseFloat(data[0].lat);
      const lng = parseFloat(data[0].lon);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { status: 'ok', lat, lng };
    }
    return { status: 'not_found' };
  } catch {
    return { status: 'error' };
  }
}

async function upsertCoordenada(row: {
  obra_id: string;
  query_normalizada: string;
  lat: number | null;
  lng: number | null;
  not_found: boolean;
}): Promise<void> {
  const supaUrl = Deno.env.get('SUPABASE_URL');
  const supaKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY');
  if (!supaUrl || !supaKey) return;
  await fetch(`${supaUrl}/rest/v1/obras_coordenadas?on_conflict=obra_id`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${supaKey}`,
      apikey: supaKey,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify([{ ...row, updated_at: new Date().toISOString() }]),
  });
}

// Geocodifica a obra e grava o resultado. NUNCA lança erro (não pode quebrar o
// salvamento da obra) e NUNCA grava nada em caso de erro de requisição.
export async function geocodeAndSaveObra(obra: {
  codigoObra?: string;
  localizacao?: string;
  cidade?: string;
}): Promise<void> {
  try {
    const obraId = (obra.codigoObra || '').trim();
    const query = buildObraQuery(obra);
    if (!obraId || !query) return;
    const queryNorm = normalizeText(query);

    let result = await geocodeQuery(query);

    // Fallback: tenta só a cidade quando a query completa não foi encontrada.
    if (result.status === 'not_found' && (obra.cidade || '').trim()) {
      await new Promise((r) => setTimeout(r, 1100)); // respeita o rate limit do Nominatim
      result = await geocodeQuery((obra.cidade || '').trim());
    }

    if (result.status === 'ok') {
      await upsertCoordenada({
        obra_id: obraId,
        query_normalizada: queryNorm,
        lat: result.lat,
        lng: result.lng,
        not_found: false,
      });
    } else if (result.status === 'not_found') {
      await upsertCoordenada({
        obra_id: obraId,
        query_normalizada: queryNorm,
        lat: null,
        lng: null,
        not_found: true,
      });
    }
    // status === 'error': não grava nada — o backfill do mapa resolve depois.
  } catch (e) {
    console.warn('geocodeAndSaveObra falhou:', e);
  }
}

// Executa uma promise em segundo plano sem bloquear a resposta HTTP.
export function runInBackground(p: Promise<unknown>): void {
  try {
    // deno-lint-ignore no-explicit-any
    const er = (globalThis as any).EdgeRuntime;
    if (er && typeof er.waitUntil === 'function') {
      er.waitUntil(p);
      return;
    }
  } catch {
    // ignore
  }
  p.catch((e) => console.warn('tarefa em segundo plano falhou:', e));
}
