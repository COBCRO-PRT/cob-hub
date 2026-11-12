/**
 * Pedido do cliente (docs/placar-pedido-cliente.md): o link sem login, o mês
 * pedido e a referência neutra que a página mostra. Só roda no servidor.
 */
import { lastClosedWeek, scoreFor } from "./score";
import type { PlacarClient, PlacarEntry, PlacarPedido } from "./types";

const enc = new TextEncoder();

/**
 * Código do link: 10 primeiros hex do HMAC-SHA256 de `meta:<id>` com o segredo
 * do hub. Sem coluna nova; trocar o segredo invalida todos os links.
 */
export async function pedidoCode(clientId: string): Promise<string | null> {
  const secret = process.env.HUB_SESSION_SECRET;
  if (!secret) return null;
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(`meta:${clientId}`)));
  return Array.from(sig.slice(0, 5), (b) => b.toString(16).padStart(2, "0")).join("");
}

export const pedidoPath = (clientId: string, code: string) => `/meta/${encodeURIComponent(clientId)}/${code}`;

export const pedidoId = (clientId: string, month: string) => `${clientId}_${month}`;

export { currentMonth, nextMonth, monthLabel } from "./pedido-shared";

/** Unidade que o cliente vê: a da ficha, ou "resultados". */
export function unitOf(c: Pick<PlacarClient, "meta_label" | "kind">): string {
  if (c.kind === "projeto") return "marcos";
  return c.meta_label.trim() || "resultados";
}

/**
 * Referência neutra, sem a meta da COB: o resultado das últimas 4 semanas
 * fechadas, pela mesma conta da nota. Nulo sem leitura.
 */
export function referenceFor(c: PlacarClient, entries: PlacarEntry[]): { value: number; weeks: number } | null {
  if (c.kind !== "resultado") return null;
  const s = scoreFor(c, lastClosedWeek(), entries.filter((e) => e.client === c.id));
  if (!s.weeks) return null;
  const value = c.meta_mode === "taxa" || c.meta_mode === "custo" ? (s.avg ?? 0) : s.sum;
  return { value, weeks: s.weeks };
}

/** O pedido de um cliente para um mês, se existe. */
export const pedidoOf = (list: PlacarPedido[], clientId: string, month: string) =>
  list.find((p) => p.client === clientId && p.month === month) ?? null;
