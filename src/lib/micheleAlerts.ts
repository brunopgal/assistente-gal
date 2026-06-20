import { Obra } from "@/services/obrasService";
import { Atividade } from "@/services/atividadesService";

export interface MicheleAlert {
  id: string;
  codigoObra: string;
  obraNome: string;
  tipo: "email_sem_resposta" | "prospeccao_parada" | "orcamento_sem_retorno";
  mensagem: string;
  dias: number;
}

function parseDateBR(str: string): Date | null {
  if (!str) return null;
  const parts = str.split("/");
  if (parts.length === 3) {
    const d = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
    if (!isNaN(d.getTime())) return d;
  }
  const iso = new Date(str);
  if (!isNaN(iso.getTime())) return iso;
  return null;
}

function diffDays(from: Date, to: Date): number {
  from.setHours(0, 0, 0, 0);
  to.setHours(0, 0, 0, 0);
  const diffTime = to.getTime() - from.getTime();
  return Math.floor(diffTime / (1000 * 3600 * 24));
}

export function calcularAlertasMichele(
  obras: Obra[],
  atividadesMap: Record<string, Atividade>,
  config?: { diasOrcamentoSemRetorno?: number }
): MicheleAlert[] {
  const alertas: MicheleAlert[] = [];
  const hoje = new Date();
  
  const diasOrcamento = config?.diasOrcamentoSemRetorno || 7;

  for (const obra of obras) {
    const codigo = obra.codigoObra || (obra as any).id;
    if (!codigo) continue;

    const statusAtivo = obra.statusProspeccao || "";
    const ultimaAtividade = atividadesMap[codigo];
    const nome = obra.nome || "Obra";

    // Ignora status que não exigem prospecção ativa ou que já foram convertidos/encerrados
    const statusIgnorados = ["Negociação", "Encerrado", "Fechado", "Perdido"];
    if (statusIgnorados.includes(statusAtivo)) {
      continue;
    }

    let diasDesdeUltima = 0;
    if (ultimaAtividade && ultimaAtividade.dataAtividade) {
      const dataAtiv = parseDateBR(ultimaAtividade.dataAtividade);
      if (dataAtiv) {
        diasDesdeUltima = diffDays(dataAtiv, hoje);
      }
    } else {
      // Se não tem atividade, podemos calcular a partir do cadastro, ou assumir um número alto para forçar o alerta de "parado"
      if (obra.dataCadastro) {
        const dCad = parseDateBR(obra.dataCadastro) || new Date(obra.dataCadastro);
        if (dCad && !isNaN(dCad.getTime())) {
          diasDesdeUltima = diffDays(dCad, hoje);
        }
      }
    }

    // Regra 1: E-mail sem resposta (5 dias)
    if (
      ultimaAtividade &&
      ultimaAtividade.tipoContato === "email" &&
      diasDesdeUltima >= 5 &&
      statusAtivo !== "Lead Quente" &&
      statusAtivo !== "Orçamento Enviado"
    ) {
      alertas.push({
        id: `email_${codigo}`,
        codigoObra: codigo,
        obraNome: nome,
        tipo: "email_sem_resposta",
        mensagem: `Enviou e-mail há ${diasDesdeUltima} dias sem resposta. Mande outro e-mail ou tente WhatsApp.`,
        dias: diasDesdeUltima,
      });
      continue; // Evita empilhar o alerta de prospecção parada junto com este
    }

    // Regra 3: Orçamento sem retorno (usando config)
    if (statusAtivo === "Orçamento Enviado" && diasDesdeUltima >= diasOrcamento) {
      alertas.push({
        id: `orc_${codigo}`,
        codigoObra: codigo,
        obraNome: nome,
        tipo: "orcamento_sem_retorno",
        mensagem: `Orçamento da obra enviado há ${diasDesdeUltima} dias sem resposta. Faça follow-up.`,
        dias: diasDesdeUltima,
      });
      continue;
    }

    // Regra 2: Prospecção Parada (10 dias)
    // Se está em prospecção ou lead quente há muito tempo sem ação
    if (
      (statusAtivo === "Em Prospecção" || statusAtivo === "Prospectar" || statusAtivo === "Lead Quente") &&
      diasDesdeUltima >= 10
    ) {
      alertas.push({
        id: `parada_${codigo}`,
        codigoObra: codigo,
        obraNome: nome,
        tipo: "prospeccao_parada",
        mensagem: `Obra parada há ${diasDesdeUltima} dias. Mova a negociação ou encerre.`,
        dias: diasDesdeUltima,
      });
    }
  }

  // Ordena pelos que tem mais dias parados primeiro
  return alertas.sort((a, b) => b.dias - a.dias);
}
