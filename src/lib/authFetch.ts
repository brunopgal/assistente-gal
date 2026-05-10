import { supabase } from "@/integrations/supabase/client";

/**
 * Returns headers with the current user's access token.
 * Used by services that call edge functions — ensures only logged-in users
 * can read/write data through the backend.
 */
export async function buildAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const apikey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!token) {
    throw new Error("Sessão expirada. Faça login novamente.");
  }
  return {
    Authorization: `Bearer ${token}`,
    apikey,
    "Content-Type": "application/json",
  };
}
