/** Mês e rótulos do pedido do cliente, sem segredo: roda no navegador e no servidor. */

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** AAAA-MM de hoje em Brasília. */
export function currentMonth(now = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }).slice(0, 7);
}

/** O mês que a página pergunta: o seguinte ao atual. */
export function nextMonth(now = new Date()): string {
  const [y, m] = currentMonth(now).split("-").map(Number);
  const d = new Date(Date.UTC(y, m, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** "dezembro de 2026". */
export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${MONTHS[(m - 1 + 12) % 12]} de ${y}`;
}
