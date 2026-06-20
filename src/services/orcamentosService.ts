import { supabase } from "@/integrations/supabase/client";

export type StatusOrcamento = "Enviado" | "Em Análise" | "Aprovado" | "Recusado";
export type ProdutoOrcamento = "Prado" | "Rohden" | "Imab" | string;

export interface Orcamento {
  id?: string;
  codigoObra: string;
  produto: ProdutoOrcamento;
  valor?: number | null;
  link_anexo?: string | null;
  data_envio: string; // formato YYYY-MM-DD para o banco
  status: StatusOrcamento;
  notas?: string | null;
  created_at?: string;
  updated_at?: string;
}

export async function listarOrcamentos(): Promise<Orcamento[]> {
  const { data, error } = await supabase
    .from("orcamentos")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro ao listar orçamentos:", error);
    throw new Error(error.message);
  }
  return data || [];
}

export async function listarOrcamentosPorObra(codigoObra: string): Promise<Orcamento[]> {
  const { data, error } = await supabase
    .from("orcamentos")
    .select("*")
    .eq("codigoObra", codigoObra)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro ao listar orçamentos da obra:", error);
    throw new Error(error.message);
  }
  return data || [];
}

export async function criarOrcamento(orcamento: Orcamento): Promise<Orcamento> {
  const { data, error } = await supabase
    .from("orcamentos")
    .insert([orcamento])
    .select()
    .single();

  if (error) {
    console.error("Erro ao criar orçamento:", error);
    throw new Error(error.message);
  }
  return data;
}

export async function atualizarStatusOrcamento(id: string, status: StatusOrcamento): Promise<Orcamento> {
  const { data, error } = await supabase
    .from("orcamentos")
    .update({ status })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Erro ao atualizar status do orçamento:", error);
    throw new Error(error.message);
  }
  return data;
}

export async function excluirOrcamento(id: string): Promise<void> {
  const { error } = await supabase.from("orcamentos").delete().eq("id", id);
  if (error) {
    console.error("Erro ao excluir orçamento:", error);
    throw new Error(error.message);
  }
}
