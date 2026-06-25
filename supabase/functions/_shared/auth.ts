// Shared JWT validation for edge functions.
// Validates the user's session token from the Authorization header
// using getClaims() which supports the new asymmetric signing-keys system.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.108.2';

export async function requireAuth(
  req: Request,
  corsHeaders: Record<string, string>,
): Promise<Response | null> {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const token = auth.slice(7);
  try {
    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
    );
    // getClaims supports asymmetric JWTs (ES256) via SUPABASE_JWKS
    // and falls back to /auth/v1/user for symmetric tokens.
    const { data, error } = await sb.auth.getClaims(token);
    if (error || !data?.claims?.sub) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  return null;
}
