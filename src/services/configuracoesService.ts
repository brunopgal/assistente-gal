import { supabase } from "@/integrations/supabase/client";

export async function getConfig(chave: string): Promise<string> {
  const { data } = await supabase
    .from("configuracoes")
    .select("valor")
    .eq("chave", chave)
    .maybeSingle();
  return data?.valor ?? "";
}

export async function setConfig(chave: string, valor: string): Promise<void> {
  const { error } = await supabase
    .from("configuracoes")
    .upsert({ chave, valor }, { onConflict: "chave" });
  if (error) throw error;
}
