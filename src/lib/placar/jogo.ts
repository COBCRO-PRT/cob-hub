/**
 * Camada de jogo da Rodada da semana: temporada, XP, conquistas e missões.
 * Regras em docs/placar-semana.md; mudar lá antes de mudar aqui.
 *
 * Puro, sem store nem ClickUp. Toda nota sai de `scoreFor`, a régua do placar.
 */
import { POINTS, STREAK, levelFor, roundOf, xpOf, type AchievementId, type Level } from "./rodada-rules";
import { addWeeks, isNum, metaWeek, scoreFor } from "./score";
import type { PlacarClient, PlacarEntry, PlacarTask, RodadaRow, RodadaTone } from "./types";

/** Até onde olhar para trás para contar sequência. */
export const LOOKBACK = 52;
const H72 = 72 * 3600_000;

export type ToneAt = (c: PlacarClient, week: string) => RodadaTone;

export function byClient(entries: PlacarEntry[]): Map<string, PlacarEntry[]> {
  const m = new Map<string, PlacarEntry[]>();
  for (const e of entries) {
    const list = m.get(e.client);
    if (list) list.push(e);
    else m.set(e.client, [e]);
  }
  return m;
}

/** Faixa do cliente numa semana: a congelada, se a rodada fechou; senão, a de agora. */
export function toneGetter(entries: PlacarEntry[], frozen: RodadaRow[]): ToneAt {
  const lists = byClient(entries);
  const fixed = new Map(frozen.map((r) => [`${r.week}_${r.client}`, r.tone]));
  const cache = new Map<string, RodadaTone>();
  return (c, week) => {
    const key = `${week}_${c.id}`;
    const f = fixed.get(key) ?? cache.get(key);
    if (f) return f;
    const t = scoreFor(c, week, lists.get(c.id) ?? []).tone;
    cache.set(key, t);
    return t;
  };
}

export function streak(toneAt: ToneAt, c: PlacarClient, week: string, tone: RodadaTone): number {
  let n = 0;
  for (let i = 0; i < LOOKBACK; i++) {
    if (toneAt(c, addWeeks(week, -i)) !== tone) break;
    n++;
  }
  return n;
}

// ---------- temporada ----------

export interface SeasonLine {
  owner: string;
  xp: number;
  level: Level;
  /** Rodadas fechadas em que teve cliente. */
  rounds: number;
  viradas: number;
  achievements: AchievementId[];
  /** Contagem das conquistas que andam aos poucos, ex.: hat-trick "2 de 3". */
  progress: Partial<Record<AchievementId, string>>;
}

interface WeekOwner {
  owner: string;
  clients: number;
  points: number;
  green: number;
  red: number;
  gray: number;
  viradas: number;
  selos: number;
}

/**
 * Tabela da temporada a partir das rodadas congeladas. `owners` são os donos de
 * hoje, para quem ainda não fechou rodada aparecer zerado.
 */
export function seasonTable(frozen: RodadaRow[], tasks: PlacarTask[], owners: string[]): SeasonLine[] {
  const lines = new Map<string, SeasonLine>();
  const line = (owner: string) => {
    let l = lines.get(owner);
    if (!l) {
      l = { owner, xp: 0, level: levelFor(0), rounds: 0, viradas: 0, achievements: [], progress: {} };
      lines.set(owner, l);
    }
    return l;
  };
  const unlock = (l: SeasonLine, id: AchievementId) => {
    if (!l.achievements.includes(id)) l.achievements.push(id);
  };
  for (const o of owners) if (o) line(o);

  const season = frozen.filter((r) => r.owner && roundOf(r.week) !== null);
  const weeks = new Map<string, Map<string, WeekOwner>>();
  for (const r of season) {
    const byOwner = weeks.get(r.week) ?? new Map<string, WeekOwner>();
    weeks.set(r.week, byOwner);
    const w = byOwner.get(r.owner) ?? { owner: r.owner, clients: 0, points: 0, green: 0, red: 0, gray: 0, viradas: 0, selos: 0 };
    byOwner.set(r.owner, w);
    w.clients++;
    w.points += r.points;
    if (r.tone === "good") w.green++;
    if (r.tone === "bad") w.red++;
    if (r.tone === "none") w.gray++;
    if (r.badges.includes("virada")) w.viradas++;
    if (r.badges.includes("sequencia")) w.selos++;
  }

  for (const byOwner of weeks.values()) {
    const ranked = [...byOwner.values()]
      .map((w) => ({ ...w, avg: w.points / w.clients }))
      .sort((a, b) => b.avg - a.avg || b.points - a.points || a.owner.localeCompare(b.owner, "pt-BR"));
    ranked.forEach((w, i) => {
      const l = line(w.owner);
      l.xp += xpOf(w.avg);
      l.rounds++;
      l.viradas += w.viradas;
      if (i === 0 && w.points > 0) unlock(l, "lider");
      if (w.selos > 0) unlock(l, "selo");
      if (w.gray === 0) unlock(l, "carteira-lida");
      if (w.gray === 0 && w.red === 0) unlock(l, "zero-vermelho");
      if (w.green === w.clients) unlock(l, "tudo-verde");
    });
  }

  // Plano em 72h: dono do cliente na rodada em que a tarefa nasceu.
  const ownerAt = new Map(frozen.map((r) => [`${r.week}_${r.client}`, r.owner]));
  for (const t of tasks) {
    if (!t.closed || !t.closed_at || t.status === "fora da lista") continue;
    if (Date.parse(t.closed_at) - Date.parse(t.created_at) > H72) continue;
    const owner = ownerAt.get(`${t.week}_${t.client}`);
    if (owner) unlock(line(owner), "plano-72h");
  }

  for (const l of lines.values()) {
    l.level = levelFor(l.xp);
    if (l.viradas > 0) unlock(l, "virada");
    if (l.viradas >= 3) unlock(l, "hat-trick");
    else l.progress["hat-trick"] = `${l.viradas} de 3`;
  }
  return [...lines.values()].sort((a, b) => b.xp - a.xp || a.owner.localeCompare(b.owner, "pt-BR"));
}

// ---------- missões ----------

export type MissionKind = "virada" | "selo" | "verde" | "segurar" | "cinza";

export interface Mission {
  client: string;
  name: string;
  owner: string;
  kind: MissionKind;
  /** Quanto a missão vale, com leitura e verde quando entram juntos. */
  points: number;
  /** O que fazer nesta semana, numa linha. */
  todo: string;
  /** A avaliação do cliente segura a nota: lançar número sozinho não resolve. */
  blocked: boolean;
  done: boolean;
  /** Faixa ao vivo da semana. */
  tone: RodadaTone;
  score: number | null;
}

export interface LaunchLine {
  owner: string;
  done: number;
  total: number;
}

const nf = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
const reach = (n: number | null, target: number) => n !== null && n >= target;

/** Nota da semana `week` se o lançamento dela fosse `value`. */
function simulate(c: PlacarClient, list: PlacarEntry[], week: string, value: number, weeks: number) {
  const base = list.find((e) => e.week === week);
  const e: PlacarEntry = {
    id: `${c.id}_${week}`,
    client: c.id,
    week,
    milestone: null,
    client_score: null,
    note: "",
    updated_at: "",
    ...base,
    weeks,
    value,
  };
  return scoreFor(c, week, [...list.filter((x) => x.week !== week), e]).final;
}

/**
 * O que lançar na semana `week` para a nota chegar em `target` (4 = amarelo,
 * 7 = verde). Simula na própria régua; nunca refaz a conta por fora.
 */
export function needToReach(
  c: PlacarClient,
  list: PlacarEntry[],
  week: string,
  target: number,
): { todo: string; blocked: boolean } {
  const s = scoreFor(c, week, list);
  if (s.cs !== null && s.cs < target) {
    return { todo: `A avaliação do cliente (${nf.format(s.cs)}) segura a nota: conversar com ele`, blocked: true };
  }
  if (c.kind === "projeto") return { todo: "Entregar o marco no prazo e marcar no placar", blocked: false };
  const mw = metaWeek(c);
  if (mw === null) return { todo: "Definir a meta do cliente no placar", blocked: false };

  const latest = [...list].sort((a, b) => b.week.localeCompare(a.week))[0];
  const weeks = list.find((e) => e.week === week)?.weeks ?? latest?.weeks ?? 1;
  const month = weeks > 1;
  const label = c.meta_label ? ` ${c.meta_label}` : "";
  const when = month ? "no mês (número do mês inteiro)" : "na semana";
  const sim = (v: number) => simulate(c, list, week, v, weeks);

  if (c.meta_mode === "custo") {
    // Custo menor dá nota maior: procura o maior custo que ainda chega lá.
    if (!reach(sim(0), target)) return { todo: "Nem com custo zero nesta semana chega lá: rever a meta", blocked: true };
    let hi = mw * 10;
    for (let i = 0; i < 40 && reach(sim(hi), target); i++) hi *= 4;
    let lo = 0;
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      if (reach(sim(mid), target)) lo = mid;
      else hi = mid;
    }
    const v = Math.floor(lo * 100) / 100;
    return { todo: `Fechar ${when} com${label || " custo"} de até ${nf.format(v)}`, blocked: false };
  }

  if (reach(sim(0), target)) return { todo: `As semanas anteriores já garantem: só lançar o número ${when}`, blocked: false };
  let hi = Math.max(1, mw) * 8;
  for (let i = 0; i < 40 && !reach(sim(hi), target); i++) hi *= 4;
  if (!reach(sim(hi), target)) return { todo: "Só número não resolve nesta semana: rever a meta", blocked: true };
  let lo = 0;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (reach(sim(mid), target)) hi = mid;
    else lo = mid;
  }
  if (c.meta_mode === "taxa") {
    const v = Math.ceil(hi * 100 - 1e-6) / 100;
    return { todo: `Fechar ${when} com${label || " taxa"} de ${nf.format(v)} ou mais`, blocked: false };
  }
  const whole = Math.ceil(hi - 1e-9);
  const v = reach(sim(whole), target) ? whole : Math.ceil(hi * 100) / 100;
  return { todo: `Lançar ${nf.format(v)}${label} ${when}`, blocked: false };
}

/** Missões da semana `week` (em andamento) e quanto de cada carteira já foi lançado. */
export function weekMissions(
  clients: PlacarClient[],
  entries: PlacarEntry[],
  frozen: RodadaRow[],
  week: string,
): { missions: Mission[]; launch: LaunchLine[] } {
  const toneAt = toneGetter(entries, frozen);
  const lists = byClient(entries);
  const missions: Mission[] = [];
  const launch = new Map<string, LaunchLine>();
  const prevWeek = addWeeks(week, -1);

  for (const c of clients.filter((x) => x.active)) {
    const list = lists.get(c.id) ?? [];
    const owner = c.owner.trim();
    const s = scoreFor(c, week, list);
    const tone = s.tone;

    if (owner) {
      const l = launch.get(owner) ?? { owner, done: 0, total: 0 };
      l.total++;
      if (list.some((e) => e.week === week && (isNum(e.value) || typeof e.milestone === "boolean"))) l.done++;
      launch.set(owner, l);
    }

    const prev = toneAt(c, prevWeek);
    const prevGreen = prev === "good" ? streak(toneAt, c, prevWeek, "good") : 0;
    let kind: MissionKind;
    let target: number;
    let points: number;
    let done: boolean;
    if (prev === "bad") {
      kind = "virada";
      target = 4;
      points = POINTS.virada + POINTS.leitura;
      done = tone === "warn" || tone === "good";
    } else if (prevGreen > 0 && (prevGreen + 1) % STREAK === 0) {
      kind = "selo";
      target = 7;
      points = POINTS.sequencia + POINTS.verde + POINTS.leitura;
      done = tone === "good";
    } else if (prev === "good") {
      if (tone === "good") continue;
      kind = "segurar";
      target = 7;
      points = POINTS.verde;
      done = false;
    } else if (prev === "warn") {
      kind = "verde";
      target = 7;
      points = POINTS.verde;
      done = tone === "good";
    } else {
      kind = "cinza";
      target = 0;
      points = POINTS.leitura;
      done = tone !== "none";
    }

    let todo: string;
    let blocked = false;
    if (done) todo = "Cumprida pela nota de agora";
    else if (kind === "cinza") {
      todo =
        c.kind === "projeto"
          ? "Marcar o marco da semana no placar"
          : metaWeek(c) === null
            ? "Definir a meta do cliente no placar"
            : "Lançar o número da semana no placar";
    } else ({ todo, blocked } = needToReach(c, list, week, target));

    missions.push({ client: c.id, name: c.name, owner, kind, points, todo, blocked, done, tone, score: s.final });
  }

  const order: Record<MissionKind, number> = { virada: 0, selo: 1, segurar: 2, verde: 3, cinza: 4 };
  missions.sort((a, b) => Number(a.done) - Number(b.done) || order[a.kind] - order[b.kind] || a.name.localeCompare(b.name, "pt-BR"));
  return { missions, launch: [...launch.values()].sort((a, b) => a.owner.localeCompare(b.owner, "pt-BR")) };
}
