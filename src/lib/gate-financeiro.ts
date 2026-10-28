/**
 * Segunda trava, só pra área financeira.
 *
 * A senha do time abre o menu inteiro e o cookie dura 90 dias, o que é ótimo
 * pra uma lista de atalhos e péssimo pra uma tela que emite nota fiscal.
 * Emitir é ato fiscal e cancelar dá trabalho, então aqui vai senha separada
 * e sessão curta.
 */
export const FINANCE_COOKIE_NAME = "cob_hub_financeiro";

/** 12 horas: dura o dia de trabalho e morre antes do dia seguinte. */
export const FINANCE_COOKIE_MAX_AGE = 60 * 60 * 12;

/**
 * Hash da senha do financeiro. Retorna null quando HUB_FINANCE_PASSWORD não
 * está configurada, e aí a área fica fechada em vez de aberta.
 */
export async function financeToken(): Promise<string | null> {
  const senha = process.env.HUB_FINANCE_PASSWORD;
  if (!senha) return null;

  const bytes = new TextEncoder().encode(`cob-hub-financeiro::${senha}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
