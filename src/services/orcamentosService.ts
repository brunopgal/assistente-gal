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
  return (data || []) as Orcamento[];
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
  return (data || []) as Orcamento[];
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
  return data as Orcamento;
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
  return data as Orcamento;
}

export async function excluirOrcamento(id: string): Promise<void> {
  const { error } = await supabase.from("orcamentos").delete().eq("id", id);
  if (error) {
    console.error("Erro ao excluir orçamento:", error);
    throw new Error(error.message);
  }
}

export interface ArquivoOrcamento {
  nome: string;
  url: string;
}

export interface BlocoOrcamento {
  produto: "Prado" | "Rohden" | "Imab" | "Outros";
  nome?: string;
  titulo: string;
  arquivos: ArquivoOrcamento[];
}

export interface OrcamentoPagina {
  id: string;
  codigo_obra: string;
  titulo_versao: string;
  ativo: boolean;
  blocos: BlocoOrcamento[];
  token_orcamento: string;
  token_apresentacao: string;
  created_at?: string;
  updated_at?: string;
}

function generateToken(): string {
  try {
    const uuid = (crypto as any).randomUUID();
    return uuid.replace(/-/g, "");
  } catch (e) {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}

export async function listarOrcamentosDaObra(codigoObra: string): Promise<OrcamentoPagina[]> {
  const { data, error } = await supabase
    .from("orcamento_paginas" as any)
    .select("*")
    .eq("codigo_obra", codigoObra)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro ao listar orçamentos da obra:", error);
    throw new Error(error.message);
  }
  return (data || []) as unknown as OrcamentoPagina[];
}

export async function criarOrcamentoPagina(codigoObra: string, tituloVersao: string): Promise<OrcamentoPagina> {
  const token_orcamento = generateToken();
  const token_apresentacao = generateToken();
  const { data, error } = await supabase
    .from("orcamento_paginas" as any)
    .insert([
      {
        codigo_obra: codigoObra,
        titulo_versao: tituloVersao,
        ativo: true,
        blocos: [],
        token_orcamento,
        token_apresentacao,
      },
    ])
    .select()
    .single();

  if (error) {
    console.error("Erro ao criar orçamento da página:", error);
    throw new Error(error.message);
  }
  return data as unknown as OrcamentoPagina;
}

export async function atualizarOrcamento(
  id: string,
  patch: Partial<Pick<OrcamentoPagina, "titulo_versao" | "ativo" | "blocos">>
): Promise<OrcamentoPagina> {
  const { data, error } = await supabase
    .from("orcamento_paginas" as any)
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Erro ao atualizar orçamento:", error);
    throw new Error(error.message);
  }
  return data as unknown as OrcamentoPagina;
}

export async function excluirOrcamentoPagina(id: string): Promise<void> {
  const { error } = await supabase
    .from("orcamento_paginas" as any)
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Erro ao excluir orçamento da página:", error);
    throw new Error(error.message);
  }
}

export async function uploadArquivoOrcamento(codigoObra: string, file: File): Promise<string> {
  const fileName = `${Date.now()}-${file.name}`;
  const filePath = `${codigoObra}/${fileName}`;

  const { data, error } = await supabase.storage
    .from("orcamentos")
    .upload(filePath, file);

  if (error) {
    console.error("Erro no upload do arquivo:", error);
    throw new Error(error.message);
  }

  const { data: publicUrlData } = supabase.storage
    .from("orcamentos")
    .getPublicUrl(filePath);

  return publicUrlData.publicUrl;
}

export async function listarTodosOrcamentos(): Promise<OrcamentoPagina[]> {
  const { data, error } = await supabase
    .from("orcamento_paginas" as any)
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro ao listar todos os orçamentos:", error);
    throw new Error(error.message);
  }
  return (data || []) as unknown as OrcamentoPagina[];
}

export async function buscarOrcamentoPorToken(token: string): Promise<OrcamentoPagina | null> {
  const { data, error } = await supabase
    .from("orcamento_paginas" as any)
    .select("*")
    .eq("token_orcamento", token)
    .maybeSingle();

  if (error) {
    console.error("Erro ao buscar orçamento por token:", error);
    throw new Error(error.message);
  }
  return data as unknown as OrcamentoPagina | null;
}

export async function buscarObraPorCodigoPublico(codigoObra: string): Promise<any | null> {
  const { data, error } = await supabase
    .from("obras" as any)
    .select("*")
    .eq("codigoObra", codigoObra)
    .maybeSingle();

  if (error) {
    console.error("Erro ao buscar obra por código:", error);
    return null;
  }
  return data;
}

export interface ResumoAberturasObra {
  temOrcamento: boolean;
  totalAberturas: number;
}

export async function contarAberturas(paginaId: string): Promise<{ total: number; ultima: string | null }> {
  const { data, error, count } = await supabase
    .from("orcamento_aberturas" as any)
    .select("aberto_em", { count: "exact" })
    .eq("pagina_id", paginaId)
    .eq("tipo", "orcamento")
    .order("aberto_em", { ascending: false });

  if (error) {
    console.error("Erro ao contar aberturas:", error);
    throw new Error(error.message);
  }

  const total = count || 0;
  const ultima = data && data.length > 0 ? data[0].aberto_em : null;

  return { total, ultima };
}

export async function obterResumoAberturasPorObra(codigoObras: string[]): Promise<Record<string, ResumoAberturasObra>> {
  if (!codigoObras || codigoObras.length === 0) return {};

  const { data: paginas, error: errPaginas } = await supabase
    .from("orcamento_paginas" as any)
    .select("id, codigo_obra")
    .in("codigo_obra", codigoObras);

  if (errPaginas) {
    console.error("Erro ao obter páginas de orçamento para resumo:", errPaginas);
    throw new Error(errPaginas.message);
  }

  const result: Record<string, ResumoAberturasObra> = {};

  for (const cod of codigoObras) {
    result[cod] = {
      temOrcamento: false,
      totalAberturas: 0,
    };
  }

  if (!paginas || paginas.length === 0) {
    return result;
  }

  const paginaIds: string[] = [];
  const paginaParaObra: Record<string, string> = {};

  for (const pag of paginas) {
    const cod = pag.codigo_obra;
    if (result[cod]) {
      result[cod].temOrcamento = true;
    }
    paginaIds.push(pag.id);
    paginaParaObra[pag.id] = cod;
  }

  if (paginaIds.length === 0) {
    return result;
  }

  const { data: aberturas, error: errAberturas } = await supabase
    .from("orcamento_aberturas" as any)
    .select("pagina_id")
    .eq("tipo", "orcamento")
    .in("pagina_id", paginaIds);

  if (errAberturas) {
    console.error("Erro ao obter aberturas de orçamento para resumo:", errAberturas);
    throw new Error(errAberturas.message);
  }

  if (aberturas) {
    for (const ab of aberturas) {
      const cod = paginaParaObra[ab.pagina_id];
      if (cod && result[cod]) {
        result[cod].totalAberturas += 1;
      }
    }
  }

  return result;
}

export interface ResumoAberturasVersao {
  total: number;
  ultima: string | null;
}

export async function obterResumoAberturasPorVersoes(paginaIds: string[]): Promise<Record<string, ResumoAberturasVersao>> {
  if (!paginaIds || paginaIds.length === 0) return {};

  const { data: aberturas, error } = await supabase
    .from("orcamento_aberturas" as any)
    .select("pagina_id, aberto_em")
    .eq("tipo", "orcamento")
    .in("pagina_id", paginaIds)
    .order("aberto_em", { ascending: false });

  if (error) {
    console.error("Erro ao obter resumo de aberturas por versões:", error);
    throw new Error(error.message);
  }

  const result: Record<string, ResumoAberturasVersao> = {};

  for (const id of paginaIds) {
    result[id] = { total: 0, ultima: null };
  }

  if (aberturas) {
    for (const ab of aberturas) {
      const pid = ab.pagina_id;
      if (result[pid]) {
        result[pid].total += 1;
        if (!result[pid].ultima) {
          result[pid].ultima = ab.aberto_em;
        }
      }
    }
  }

  return result;
}




