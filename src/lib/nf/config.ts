import type { Impostos } from "./asaas";

/**
 * Configuração fiscal da emissão.
 *
 * Nada aqui é decisão de programador: alíquota de ISS, código do serviço e
 * retenções são definidos pelo contador. Por isso moram em variável de
 * ambiente, não no código, e a tela avisa quando falta alguma.
 */
export type ConfiguracaoFiscal = {
  servicoId?: string;
  servicoCodigo?: string;
  servicoNome?: string;
  impostos: Impostos;
  observacoes: string;
};

function numero(valor: string | undefined): number {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Texto que descreve o serviço na nota.
 *
 * A descrição da assinatura no Asaas é texto de cobrança, não de nota fiscal:
 * muitas estão vazias e outras carregam o mês em que foram criadas. Quando ela
 * não serve, cai neste padrão.
 */
export function descricaoPadrao(): string {
  return process.env.NF_DESCRICAO_PADRAO || "Prestação de serviços conforme contrato";
}

export function configuracaoFiscal(): ConfiguracaoFiscal {
  return {
    servicoId: process.env.NF_SERVICO_ID || undefined,
    servicoCodigo: process.env.NF_SERVICO_CODIGO || undefined,
    servicoNome: process.env.NF_SERVICO_NOME || undefined,
    impostos: {
      // Retenção de ISS: quem retém é o tomador, e só quando a lei do município manda.
      retainIss: process.env.NF_ISS_RETIDO === "true",
      iss: numero(process.env.NF_ISS),
      // Publicidade sofre retenção de IR na fonte. O percentual vem do contador.
      ir: numero(process.env.NF_IR),
      csll: numero(process.env.NF_CSLL),
      cofins: numero(process.env.NF_COFINS),
      pis: numero(process.env.NF_PIS),
      inss: numero(process.env.NF_INSS),
    },
    observacoes: process.env.NF_OBSERVACOES ?? "",
  };
}

/**
 * O que ainda impede emitir. Lista vazia significa pronto pra valer.
 * Melhor mostrar isso na tela do que descobrir com nota recusada pela prefeitura.
 */
export function pendenciasDaConfiguracao(): string[] {
  const pendencias: string[] = [];
  const config = configuracaoFiscal();

  if (!process.env.ASAAS_API_KEY) {
    pendencias.push("ASAAS_API_KEY não configurada");
  }

  if (!config.servicoId && !config.servicoCodigo) {
    pendencias.push("Código do serviço municipal não definido (NF_SERVICO_ID ou NF_SERVICO_CODIGO)");
  }

  // No Simples Nacional o ISS é recolhido no DAS e sai zerado na nota, então
  // cobrar alíquota aqui seria alarme falso. A COB é Simples Nacional.
  if (!simplesNacional() && config.impostos.iss === 0 && !config.impostos.retainIss) {
    pendencias.push("Alíquota de ISS zerada (NF_ISS). Confirmar com o contador antes de emitir");
  }

  return pendencias;
}

/**
 * Optante pelo Simples Nacional.
 *
 * Muda duas coisas: o ISS sai zerado na nota (vai no DAS) e os campos de
 * IBS/CBS só passam a ser obrigatórios em 01/01/2027, contra 01/10/2026 de
 * quem não é optante.
 */
export function simplesNacional(): boolean {
  return process.env.NF_SIMPLES_NACIONAL !== "false";
}

/** Produção emitindo nota de verdade. Serve pra tela avisar em vermelho. */
export function emProducao(): boolean {
  return process.env.ASAAS_AMBIENTE === "producao";
}
