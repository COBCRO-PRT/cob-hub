/** Nome do cookie de sessão do hub. */
export const COOKIE_NAME = "cob_hub";

/** 90 dias, pra ninguém do time ter que digitar senha toda semana. */
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 90;

/**
 * Para onde voltar depois do login. Só aceita caminho interno simples que
 * comece com `prefix`; qualquer outra coisa (URL externa, `//`, a própria tela
 * de login) cai no `fallback`.
 */
export function safeNext(value: unknown, fallback: string, prefix = "/"): string {
  const v = typeof value === "string" ? value : "";
  if (!/^\/[A-Za-z0-9_\-/]*$/.test(v) || v.startsWith("//") || !v.startsWith(prefix) || v.includes("/entrar")) {
    return fallback;
  }
  return v;
}

/**
 * Valor que vai no cookie: hash da senha do time, nunca a senha em si.
 * Retorna null quando HUB_PASSWORD não está configurada, e aí o gate fecha.
 */
export async function sessionToken(): Promise<string | null> {
  const senha = process.env.HUB_PASSWORD;
  if (!senha) return null;

  const bytes = new TextEncoder().encode(`cob-hub::${senha}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
