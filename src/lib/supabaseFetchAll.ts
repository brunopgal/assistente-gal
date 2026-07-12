import { supabase } from "@/integrations/supabase/client";

/**
 * Busca todos os registros de uma tabela do Supabase em lotes de 1000.
 * Lança um erro caso qualquer lote falhe, garantindo que não ocorra retorno parcial silencioso.
 */
export async function fetchAll(table: string, select: string = "*"): Promise<any[]> {
  const allRows: any[] = [];
  let from = 0;
  const limit = 1000;
  let hasMore = true;

  while (hasMore) {
    const to = from + limit - 1;
    const { data, error } = await supabase
      .from(table as any)
      .select(select)
      .range(from, to);

    if (error) {
      throw new Error(`Falha ao carregar dados da tabela "${table}" (lote ${from}-${to}): ${error.message}`);
    }

    if (!data || data.length === 0) {
      hasMore = false;
    } else {
      allRows.push(...data);
      if (data.length < limit) {
        hasMore = false;
      } else {
        from += limit;
      }
    }
  }

  return allRows;
}
