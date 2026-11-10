/**
 * Escada de degraus do benchmark (docs/placar-benchmark.md; mudar lá antes de mudar aqui).
 *
 * Puro, serve ao navegador e ao servidor. A leitura de custo usa a mesma janela
 * e o mesmo rateio da nota (score.ts), para a tela nunca contar duas réguas.
 */
import { isNum, weeksBack } from "./score";
import type { Benchmark, BoardClient, PlacarEntry, ResultKind, Tier } from "./types";

export const TIER_LABEL: Record<Tier, string> = { "": "a medir", ouro: "Ouro", prata: "Prata", bronze: "Bronze", abaixo: "Abaixo" };
/** Ordem da escada; "" (a medir) fica fora da conta de subir ou descer. */
export const TIER_RANK: Record<Tier, number> = { "": 0, abaixo: 1, bronze: 2, prata: 3, ouro: 4 };
export const TIERS_UP: Tier[] = ["abaixo", "bronze", "prata", "ouro"];
/** Semanas que a curva da COB olha para trás. */
export const COB_WEEKS = 12;
/** Clientes com leitura para a curva da COB valer como referência. */
export const MIN_GROUP = 3;

export const SECTOR_LABEL: Record<string, string> = {
  "escola-idiomas": "Escola de idiomas",
  clinica: "Clínica",
  veicular: "Veicular",
  "servico-local": "Serviço local",
  imobiliaria: "Imobiliária",
  ecommerce: "E-commerce",
  b2b: "B2B",
  industria: "Indústria",
  eventos: "Eventos",
  turismo: "Turismo",
  educacao: "Educação",
  social: "Social",
};
export const KIND_LABEL: Record<ResultKind, string> = { "": "", lead: "lead", conversa: "conversa", venda: "venda" };

export type Metric = "custo" | "roas";
export const metricOf = (kind: ResultKind): Metric => (kind === "venda" ? "roas" : "custo");

export interface CostRead {
  kind: Exclude<ResultKind, "">;
  metric: Metric;
  /** Gasto rateado na janela, em reais. */
  spend: number;
  /** Resultado rateado na janela (contatos, leads ou reais vendidos). */
  result: number;
  /** Custo por resultado (R$) ou retorno (x). Nulo quando houve gasto e nenhum resultado. */
  value: number | null;
  weeks: number;
}

/** Resultado do lançamento para a régua: no e-commerce em taxa, os reais vendidos vêm do detalhe. */
function resultOf(e: PlacarEntry, kind: Exclude<ResultKind, "">, taxa: boolean): number | null {
  if (kind === "venda" && taxa) {
    const d = e.detail ?? {};
    const v = (d.meta?.venda ?? 0) + (d.google?.venda ?? 0);
    return d.meta || d.google ? v : null;
  }
  return isNum(e.value) ? e.value : null;
}

/**
 * Gasto e resultado do cliente nas `weeks` semanas até W. Lançamento de mês
 * inteiro (weeks = 4) é rateado pelas semanas que cobre, como na nota.
 */
export function costFor(c: BoardClient, W: string, list: PlacarEntry[], weeks = 4): CostRead | null {
  const kind = c.result_kind;
  if (!kind) return null;
  const win = new Set(weeksBack(W, weeks));
  const taxa = c.meta_mode === "taxa";
  let spend = 0;
  let result = 0;
  const covered = new Set<string>();
  for (const e of list) {
    if (!e.week || e.week > W || !isNum(e.spend)) continue;
    const span = e.weeks > 1 ? Math.round(e.weeks) : 1;
    const overlap = weeksBack(e.week, span).filter((w) => win.has(w));
    if (!overlap.length) continue;
    const f = overlap.length / span;
    spend += e.spend * f;
    const r = resultOf(e, kind, taxa);
    if (r !== null) result += r * f;
    overlap.forEach((w) => covered.add(w));
  }
  if (!covered.size || spend <= 0) return null;
  const metric = metricOf(kind);
  // Gasto sem resultado: sem leitura (nulo), e não "0x" ou custo infinito. O degrau vira Abaixo.
  const value = result <= 0 ? null : metric === "roas" ? result / spend : spend / result;
  return { kind, metric, spend, result, value, weeks: covered.size };
}

// ---------- curvas ----------

export interface Curve {
  p25: number | null;
  p50: number | null;
  p75: number | null;
  p90?: number | null;
}

/** Quantil com interpolação linear, lista já ordenada. */
function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/** Curva da COB a partir das leituras dos clientes do grupo. Menos de MIN_GROUP leituras: nulo. */
export function cobCurve(values: number[]): Curve | null {
  const s = values.filter((v) => isNum(v) && v > 0).sort((a, b) => a - b);
  if (s.length < MIN_GROUP) return null;
  return { p25: quantile(s, 0.25), p50: quantile(s, 0.5), p75: quantile(s, 0.75), p90: quantile(s, 0.9) };
}

export const groupKey = (c: Pick<BoardClient, "sector" | "result_kind">) => `${c.sector}_${c.result_kind}`;

/** A linha de mercado do grupo: Meta primeiro; Google só quando a Meta não tem. */
export function marketFor(benchmarks: Benchmark[], c: Pick<BoardClient, "sector" | "result_kind">): Benchmark | null {
  const rows = benchmarks.filter((b) => b.sector === c.sector && b.result_kind === c.result_kind && isNum(b.p50));
  return rows.find((b) => b.platform === "meta") ?? rows[0] ?? null;
}

// ---------- degrau ----------

export interface Step {
  tier: Tier;
  /** Limite do degrau: custo máximo ou retorno mínimo. */
  limit: number;
}

/**
 * Limites de cada degrau para um grupo. Sem mercado, a curva da COB faz as vezes
 * (Prata = p25 da COB, Ouro a medir). Grupo pequeno: Bronze = 1,5 x p50 do mercado.
 */
export function ladderFor(metric: Metric, market: Curve | null, cob: Curve | null): Step[] {
  const steps: Step[] = [];
  const push = (tier: Tier, limit: number | null | undefined) => {
    if (isNum(limit) && limit > 0) steps.push({ tier, limit });
  };
  if (metric === "custo") {
    if (market) {
      push("ouro", market.p25);
      push("prata", market.p50);
      push("bronze", cob ? cob.p50 : isNum(market.p50) ? market.p50 * 1.5 : null);
    } else if (cob) {
      push("prata", cob.p25);
      push("bronze", cob.p50);
    }
  } else if (market) {
    push("ouro", market.p75);
    push("prata", market.p50);
    push("bronze", cob ? cob.p50 : isNum(market.p50) ? market.p50 / 1.5 : null);
  } else if (cob) {
    push("prata", cob.p75);
    push("bronze", cob.p50);
  }
  return steps;
}

export interface TierRead {
  tier: Tier;
  /** Próximo degrau acima e o que falta para chegar nele. Nulo em Ouro ou sem escada. */
  next: Step | null;
  steps: Step[];
}

export function tierFor(read: CostRead | null, steps: Step[]): TierRead {
  if (!read || read.value === null || !steps.length) {
    return { tier: read && read.value === null && steps.length ? "abaixo" : "", next: steps[steps.length - 1] ?? null, steps };
  }
  const v = read.value;
  const ok = (s: Step) => (read.metric === "custo" ? v <= s.limit : v >= s.limit);
  // steps vem do melhor para o pior; o primeiro que o cliente alcança é o degrau.
  for (let i = 0; i < steps.length; i++) {
    if (ok(steps[i])) return { tier: steps[i].tier, next: i > 0 ? steps[i - 1] : null, steps };
  }
  return { tier: "abaixo", next: steps[steps.length - 1], steps };
}

// ---------- carteira ----------

export interface ClientLadder {
  read: CostRead | null;
  tier: Tier;
  next: Step | null;
  steps: Step[];
  market: Benchmark | null;
  cob: Curve | null;
  /** De onde veio a curva da COB: o grupo (setor + tipo) ou a COB geral do mesmo tipo de resultado. */
  cobScope: "grupo" | "geral" | null;
  /** Clientes do grupo com leitura (para a tela dizer "4 clientes no grupo"). */
  group: number;
}

/**
 * Quem pode ter degrau: cliente de resultado fora do setor Social. Projeto e social
 * não têm custo por resultado para comparar (docs/placar-semana.md, "fora da mídia").
 */
export const onLadder = (c: Pick<BoardClient, "kind" | "sector">) => c.kind === "resultado" && c.sector !== "social";

/**
 * Degrau de cada cliente ativo de mídia na semana W. A curva da COB de cada grupo
 * sai das leituras de 12 semanas dos clientes do grupo; o degrau de cada um usa
 * a janela de 4 semanas, igual à nota.
 */
export function buildLadder(
  clients: BoardClient[],
  entriesByClient: Map<string, PlacarEntry[]>,
  benchmarks: Benchmark[],
  W: string,
): Map<string, ClientLadder> {
  const out = new Map<string, ClientLadder>();
  const longReads = new Map<string, number[]>();
  const kindReads = new Map<string, number[]>();
  const media = clients.filter((c) => c.active && onLadder(c) && c.result_kind && c.sector);
  for (const c of media) {
    const r = costFor(c, W, entriesByClient.get(c.id) ?? [], COB_WEEKS);
    if (r && r.value !== null) {
      const k = groupKey(c);
      longReads.set(k, [...(longReads.get(k) ?? []), r.value]);
      kindReads.set(c.result_kind, [...(kindReads.get(c.result_kind) ?? []), r.value]);
    }
  }
  for (const c of media) {
    const k = groupKey(c);
    const values = longReads.get(k) ?? [];
    // Grupo pequeno: a curva da COB geral do mesmo tipo de resultado faz as vezes, marcada como tal.
    let cob = cobCurve(values);
    let cobScope: ClientLadder["cobScope"] = cob ? "grupo" : null;
    if (!cob) {
      cob = cobCurve(kindReads.get(c.result_kind) ?? []);
      if (cob) cobScope = "geral";
    }
    const market = marketFor(benchmarks, c);
    const steps = ladderFor(metricOf(c.result_kind), market, cob);
    const read = costFor(c, W, entriesByClient.get(c.id) ?? [], 4);
    const t = tierFor(read, steps);
    out.set(c.id, { read, tier: t.tier, next: t.next, steps, market, cob, cobScope: t.tier ? cobScope : null, group: values.length });
  }
  return out;
}

// ---------- texto ----------

const brl2 = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
const x1 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

/** "R$ 18,40" ou "2,1x". */
export function fmtRead(metric: Metric, v: number | null): string {
  if (v === null) return "sem resultado";
  return metric === "custo" ? brl2.format(v) : `${x1.format(v)}x`;
}

/** "subir para Prata: custo precisa cair de R$ 18,40 para R$ 6,24". */
export function nextText(l: Pick<ClientLadder, "read" | "tier" | "next">): string | null {
  if (!l.next || !l.read) return null;
  const to = TIER_LABEL[l.next.tier];
  if (l.read.value === null) return `subir para ${to}: precisa de resultado com o gasto que já tem`;
  if (l.read.metric === "custo") {
    return `subir para ${to}: custo precisa cair de ${fmtRead("custo", l.read.value)} para ${fmtRead("custo", l.next.limit)}`;
  }
  return `subir para ${to}: retorno precisa subir de ${fmtRead("roas", l.read.value)} para ${fmtRead("roas", l.next.limit)}`;
}

// ---------- por plataforma ----------

export type Platform = "meta" | "google";
export const PLATFORM_LABEL: Record<Platform, string> = { meta: "Meta", google: "Google" };

export interface PlatformRead {
  platform: Platform;
  spend: number;
  result: number;
  value: number | null;
}

/**
 * Gasto e resultado de uma plataforma na mesma janela, a partir do `detail` dos
 * lançamentos. Serve para a tela separar Meta de Google (o Google não tem coorte
 * de mercado; a referência dele é a própria carteira COB).
 */
export function platformFor(c: BoardClient, W: string, list: PlacarEntry[], platform: Platform, weeks = 4): PlatformRead | null {
  const kind = c.result_kind;
  if (!kind) return null;
  const win = new Set(weeksBack(W, weeks));
  let spend = 0;
  let result = 0;
  let seen = false;
  for (const e of list) {
    if (!e.week || e.week > W) continue;
    const d = e.detail?.[platform];
    if (!d) continue;
    const span = e.weeks > 1 ? Math.round(e.weeks) : 1;
    const overlap = weeksBack(e.week, span).filter((w) => win.has(w));
    if (!overlap.length) continue;
    const f = overlap.length / span;
    seen = true;
    spend += (d.spend ?? 0) * f;
    result += (d[kind] ?? 0) * f;
  }
  if (!seen || spend <= 0) return null;
  const value = result <= 0 ? null : metricOf(kind) === "roas" ? result / spend : spend / result;
  return { platform, spend, result, value };
}

/** Curva da COB de uma plataforma para o tipo de resultado do cliente, todos os setores (quartis de 12 semanas). */
export function platformCurve(
  c: BoardClient,
  clients: BoardClient[],
  entriesByClient: Map<string, PlacarEntry[]>,
  platform: Platform,
  W: string,
): Curve | null {
  const values: number[] = [];
  for (const o of clients) {
    if (!o.active || o.kind !== "resultado" || o.result_kind !== c.result_kind) continue;
    const r = platformFor(o, W, entriesByClient.get(o.id) ?? [], platform, COB_WEEKS);
    if (r && r.value !== null) values.push(r.value);
  }
  return cobCurve(values);
}
