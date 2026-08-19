"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { cancelarNota } from "@/lib/nf/asaas";
import { configuracaoFiscal } from "@/lib/nf/config";
import { emitirNota, montarLote, type Competencia } from "@/lib/nf/lote";

/**
 * O proxy já barra quem não passou pela senha do financeiro, mas Server Action
 * é endpoint HTTP como qualquer outro. Conferir o cookie aqui também custa
 * quase nada e fecha o caminho de quem chamar a action direto.
 */
async function exigirSessaoFinanceira() {
  const { FINANCE_COOKIE_NAME, financeToken } = await import("@/lib/gate-financeiro");
  const token = await financeToken();
  const jar = await cookies();

  if (!token || jar.get(FINANCE_COOKIE_NAME)?.value !== token) {
    throw new Error("Sessão do financeiro expirada. Entre de novo pra emitir.");
  }
}

export type ResultadoEmissao = {
  referencia: string;
  ok: boolean;
  mensagem: string;
};

async function emitirUma(
  clienteId: string,
  referencia: string,
  valor: number,
  descricao: string,
): Promise<ResultadoEmissao> {
  const config = configuracaoFiscal();

  try {
    const nota = await emitirNota({
      clienteId,
      referencia,
      valor,
      descricao,
      municipalServiceId: config.servicoId,
      municipalServiceCode: config.servicoCodigo,
      municipalServiceName: config.servicoNome,
      impostos: config.impostos,
      observacoes: config.observacoes,
    });

    return {
      referencia,
      ok: true,
      mensagem: nota.number ? `Nota ${nota.number} emitida` : `Nota ${nota.status.toLowerCase()}`,
    };
  } catch (erro) {
    return { referencia, ok: false, mensagem: erro instanceof Error ? erro.message : String(erro) };
  }
}

/** Emite uma linha do lote. O valor vem do formulário porque pode ter ajuste do mês. */
export async function emitirLinha(formData: FormData) {
  await exigirSessaoFinanceira();

  const clienteId = String(formData.get("clienteId") ?? "");
  const referencia = String(formData.get("referencia") ?? "");
  const descricao = String(formData.get("descricao") ?? "");
  const valor = Number(formData.get("valor"));

  if (!clienteId || !referencia) throw new Error("Linha sem cliente ou referência.");
  if (!Number.isFinite(valor) || valor <= 0) throw new Error("Valor inválido para emissão.");

  await emitirUma(clienteId, referencia, valor, descricao);
  revalidatePath("/financeiro/notas");
}

/**
 * Emite todas as pendentes da competência.
 *
 * Relê o lote do Asaas em vez de confiar na lista que a tela mostrou, senão uma
 * aba velha aberta há duas horas emitiria em cima de dado desatualizado.
 */
export async function emitirPendentes(formData: FormData) {
  await exigirSessaoFinanceira();

  const competencia = String(formData.get("competencia") ?? "") as Competencia;
  if (!/^\d{4}-\d{2}$/.test(competencia)) throw new Error("Competência inválida.");

  const lote = await montarLote(competencia);
  const pendentes = lote.filter((linha) => linha.situacao === "pendente");

  // Em série, de propósito: emissão fiscal com erro no meio é mais fácil de
  // entender numa fila do que em dez chamadas simultâneas.
  for (const linha of pendentes) {
    await emitirUma(linha.cliente.id, linha.referencia, linha.valor, linha.descricao);
  }

  revalidatePath("/financeiro/notas");
}

/** Cancela a nota. Em SCHEDULED some o agendamento; emitida vira pedido à prefeitura. */
export async function cancelarLinha(formData: FormData) {
  await exigirSessaoFinanceira();

  const notaId = String(formData.get("notaId") ?? "");
  if (!notaId) throw new Error("Nota sem identificador.");

  await cancelarNota(notaId);
  revalidatePath("/financeiro/notas");
}
