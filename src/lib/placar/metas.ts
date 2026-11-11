/**
 * Meta automática pela escada (docs/placar-benchmark.md, "A escada").
 *
 * Todo dia 1 (cron) a meta de volume do cliente com `meta_auto` e verba prevista
 * vira verba ÷ custo-alvo do próximo degrau (ou verba × retorno-alvo, no
 * e-commerce). O alvo é o degrau acima do atual; quem está em Ouro mantém o
 * custo de Ouro e é cobrado em volume. Só roda no servidor.
 */
import { buildLadder, fmtRead, TIER_LABEL, type ClientLadder } from "./degrau";
import { byClient } from "./jogo";
import { addWeeks, lastClosedWeek } from "./score";
import type { PlacarStore } from "./store";
import type { PlacarClient } from "./types";

const nf = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

/** Quem já faz melhor que o degrau mirado recebe meta 10% acima do que faz hoje (11/11/2026). */
const STRETCH = 1.1;
/** A meta sobe no máximo 50% sobre o que o cliente faz hoje com a verba (11/11/2026). */
const CAP = 1.5;

export interface MetaChange {
  client: string;
  name: string;
  from: number | null;
  to: number;
  target: string;
  note: string;
}

/** O custo-alvo e o degrau mirado: o próximo acima, ou o próprio Ouro para quem já está lá. */
function targetOf(l: ClientLadder): { tier: string; limit: number } | null {
  if (l.next) return { tier: TIER_LABEL[l.next.tier], limit: l.next.limit };
  const top = l.steps[0];
  return top ? { tier: TIER_LABEL[top.tier], limit: top.limit } : null;
}

export function autoMetaFor(c: PlacarClient, l: ClientLadder | undefined): MetaChange | null {
  if (!c.meta_auto || !c.active || c.kind !== "resultado" || !c.result_kind) return null;
  const budget = Number(c.budget);
  if (!(budget > 0) || !l) return null;
  const tg = targetOf(l);
  if (!tg) return null;
  const roas = c.result_kind === "venda";
  const byTier = roas ? budget * tg.limit : budget / tg.limit;
  // Piso: o que o cliente já faz com a verba, mais 10%. Sem isso, quem já está no topo
  // ganhava meta pelo custo do Ouro, pior que o custo real dele, e a meta nascia frouxa.
  const now = l.read?.value ?? null;
  const atNow = now === null ? null : roas ? budget * now : budget / now;
  const byNow = atNow === null ? 0 : atNow * STRETCH;
  const stretch = byNow > byTier;
  // Teto: um degrau de cada vez. Sem ele, um custo muito fora da curva (R$ 161 por lead) virava meta 14x maior.
  const cap = atNow === null ? Infinity : atNow * CAP;
  const to = Math.max(1, Math.round(Math.min(stretch ? byNow : byTier, cap)));
  const alvo = fmtRead(roas ? "roas" : "custo", tg.limit);
  const atual = now === null ? "" : fmtRead(roas ? "roas" : "custo", now);
  const note = stretch
    ? `Meta automática: já faz ${atual} com a verba de R$ ${nf.format(budget)}, meta 10% acima do que faz hoje`
    : roas
      ? `Meta automática: verba R$ ${nf.format(budget)} × retorno-alvo ${alvo} (${tg.tier})`
      : `Meta automática: verba R$ ${nf.format(budget)} ÷ custo-alvo ${alvo} (${tg.tier})`;
  return { client: c.id, name: c.name, from: c.meta_value, to, target: stretch ? `hoje ${atual} +10%` : `${tg.tier} ${alvo}`, note };
}

export interface MetasResult {
  week: string;
  changed: MetaChange[];
  skipped: string[];
}

/** Recalcula e grava a meta dos clientes com meta automática. `dry` só calcula. */
export async function refreshAutoMetas(store: PlacarStore, dry = false): Promise<MetasResult> {
  const week = lastClosedWeek();
  const [clients, entries, benchmarks] = await Promise.all([
    store.listClients(),
    store.listEntries(addWeeks(week, -16)),
    store.listBenchmarks(),
  ]);
  const ladder = buildLadder(clients, byClient(entries), benchmarks, week);
  const changed: MetaChange[] = [];
  const skipped: string[] = [];
  const stamp = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  for (const c of clients) {
    if (!c.meta_auto) continue;
    const m = autoMetaFor(c, ladder.get(c.id));
    if (!m) {
      skipped.push(c.id);
      continue;
    }
    changed.push(m);
    if (dry) continue;
    await store.updateClient(c.id, {
      meta_value: m.to,
      meta_period: "mes",
      meta_mode: c.result_kind === "venda" && c.meta_mode === "taxa" ? "taxa" : "soma",
      meta_note: `${m.note}, ${stamp}`,
      meta_review: false,
      updated_at: new Date().toISOString(),
    });
  }
  return { week, changed, skipped };
}
