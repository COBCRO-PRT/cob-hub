/**
 * Régua do Placar de Clientes.
 *
 * Porte direto da página de referência (placar-clientes.html, vanilla JS), sem
 * mudar a conta. Serve ao navegador e ao servidor, então não importa nada de
 * servidor.
 *
 * Semanas são strings AAAA-MM-DD da segunda-feira e toda a aritmética é em UTC
 * sobre essas strings. Só `mondayOf(new Date())` olha o relógio local, para a
 * semana virar na segunda do Brasil e não na de Londres.
 */
import type { BoardClient, PlacarEntry } from "./types";

export const DAY = 86400000;

export type Tone = "good" | "warn" | "bad" | "none";

export const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

export const iso = (d: Date) => d.toISOString().slice(0, 10);
export const parseIso = (s: string) => new Date(s + "T00:00:00Z");
export const addWeeks = (s: string, n: number) => iso(new Date(parseIso(s).getTime() + n * 7 * DAY));

export function mondayOf(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dow = (d.getUTCDay() + 6) % 7;
  return iso(new Date(d.getTime() - dow * DAY));
}

export const lastClosedWeek = () => addWeeks(mondayOf(new Date()), -1);

export function weeksBack(W: string, n: number): string[] {
  const a: string[] = [];
  for (let i = n - 1; i >= 0; i--) a.push(addWeeks(W, -i));
  return a;
}

function ddmm(d: Date) {
  return String(d.getUTCDate()).padStart(2, "0") + "/" + String(d.getUTCMonth() + 1).padStart(2, "0");
}

export function weekLabel(W: string) {
  const a = parseIso(W);
  return ddmm(a) + " a " + ddmm(new Date(a.getTime() + 6 * DAY));
}

/** True quando a string é uma segunda-feira válida no formato AAAA-MM-DD. */
export function isMonday(s: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = parseIso(s);
  return !Number.isNaN(d.getTime()) && iso(d) === s && d.getUTCDay() === 1;
}

/** Aceita "2,5", "1.234,56", "R$ 3.000" e "4". Vazio vira null, lixo vira NaN. */
export function parseDecLoose(v: unknown): number | null {
  let t = String(v ?? "").trim().replace(/R\$|\s/g, "");
  if (t === "") return null;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "");
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

export const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;

const nf1 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export const fmt1 = (n: number) => nf1.format(n);
export const fmt2 = (n: number) => nf2.format(n);
export const fmtBRL = (n: number) => brl.format(n);

export const PERIOD_LABEL: Record<string, string> = { dia: "dia", semana: "semana", mes: "mês" };

// ---------- nota ----------

/** Meta convertida para uma semana. Mês vale 4 semanas, a mesma janela da conta. */
export function metaWeek(c: Pick<BoardClient, "meta_value" | "meta_mode" | "meta_period">): number | null {
  const v = Number(c.meta_value);
  if (!(v > 0)) return null;
  if (c.meta_mode === "taxa" || c.meta_mode === "custo") return v;
  return c.meta_period === "dia" ? v * 7 : c.meta_period === "semana" ? v : v / 4;
}

export interface Score {
  final: number | null;
  res: number | null;
  cs: number | null;
  reason: string;
  sum: number;
  weeks: number;
  avg: number | null;
  hasW: boolean;
  mw: number | null;
  tone: Tone;
}

export const toneOf = (n: number | null): Tone =>
  n === null ? "none" : n >= 7 ? "good" : n >= 4 ? "warn" : "bad";

/**
 * Nota do cliente na semana W.
 *
 * Janela de 4 semanas até W. Lançamento de mês inteiro (weeks = 4) é rateado
 * pelas semanas que cobre. A nota do cliente vale por 5 semanas (W e as 4
 * anteriores) e, quando existe, vale a menor entre ela e o resultado. Projeto
 * tira 10 com o marco no prazo e 0 fora dele.
 */
export function scoreFor(c: BoardClient, W: string, list: PlacarEntry[]): Score {
  const win = weeksBack(W, 4);
  const winSet = new Set(win);
  const csFrom = addWeeks(W, -4);
  let sum = 0;
  const covered = new Set<string>();
  const rates: number[] = [];
  let ms: boolean | null = null;
  let msWeek = "";
  let cs: number | null = null;
  let csWeek = "";
  let hasW = false;

  for (const e of list) {
    if (!e.week || e.week > W) continue;
    const span = e.weeks > 1 ? Math.round(e.weeks) : 1;
    const covers = weeksBack(e.week, span);
    const overlap = covers.filter((w) => winSet.has(w));
    if (isNum(e.value) && overlap.length) {
      sum += (e.value * overlap.length) / span;
      overlap.forEach((w) => covered.add(w));
      rates.push(e.value);
      if (covers.includes(W)) hasW = true;
    }
    if (typeof e.milestone === "boolean" && winSet.has(e.week) && e.week > msWeek) {
      ms = e.milestone;
      msWeek = e.week;
      if (e.week === W) hasW = true;
    }
    if (isNum(e.client_score) && e.week >= csFrom && e.week > csWeek) {
      cs = Math.max(0, Math.min(10, e.client_score));
      csWeek = e.week;
    }
  }

  let res: number | null = null;
  let reason = "";
  const mw = metaWeek(c);
  if (c.kind === "projeto") {
    if (ms === null) reason = "falta marco";
    else res = ms ? 10 : 0;
  } else if (mw === null) reason = "sem meta";
  else if (!covered.size) reason = "falta número";
  else if (c.meta_mode === "taxa") res = Math.min(10, (10 * mean(rates)) / mw);
  else if (c.meta_mode === "custo") {
    const avg = mean(rates);
    res = avg > 0 ? Math.min(10, (10 * mw) / avg) : 10;
  } else res = Math.min(10, (10 * sum) / (mw * covered.size));

  const final = res === null ? null : cs === null ? res : Math.min(res, cs);
  return {
    final,
    res,
    cs,
    reason,
    sum,
    weeks: covered.size,
    avg: rates.length ? mean(rates) : null,
    hasW,
    mw,
    tone: toneOf(final),
  };
}

/** Uma casa, sempre truncada para baixo: 6,99 aparece 6,9 e não vira verde no olho. */
export const fmtScore = (n: number) => (n >= 10 ? "10" : nf1.format(Math.floor(n * 10) / 10));

/** Ordem da lista: vermelho, cinza, amarelo, verde. */
export const TONE_RANK: Record<Tone, number> = { bad: 0, none: 1, warn: 2, good: 3 };

// ---------- texto ----------

export function metaText(c: BoardClient): string | null {
  const v = Number(c.meta_value);
  if (!(v > 0)) return null;
  const label = c.meta_label || "";
  if (c.meta_mode === "taxa") return `${label || "taxa"} ≥ ${nf2.format(v)}`;
  if (c.meta_mode === "custo") return `${label || "custo"} ≤ ${nf2.format(v)}`;
  return `${nf2.format(v)} ${label}/${PERIOD_LABEL[c.meta_period] || "mês"}`;
}

export function slug(t: string) {
  return (
    (t || "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "cliente"
  );
}

export const entryId = (client: string, week: string) => `${client}_${week}`;
