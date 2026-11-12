/**
 * Rodada da semana: pontos, ranking e as tarefas dos vermelhos.
 * Regras em docs/placar-semana.md; mudar lá antes de mudar aqui.
 *
 * Só roda no servidor (usa o store e o ClickUp).
 */
import { clickupConfig, clickupUserFor, createTask, escalateTask, listTaskStates } from "@/lib/clickup";
import {
  LOOKBACK,
  byClient,
  needToReach,
  seasonTable,
  streak,
  toneGetter,
  weekMissions,
  type LaunchLine,
  type Mission,
  type SeasonLine,
} from "./jogo";
import { currentMonth } from "./pedido-shared";
import { POINTS, QUARTER_START, SEASON, STREAK, TEAM_GOAL, roundOf, xpOf } from "./rodada-rules";
import { TIER_RANK, buildLadder, fmtRead, nextText, type ClientLadder } from "./degrau";
import { addWeeks, fmtScore, metaText, mondayOf, scoreFor, weekLabel } from "./score";
import type { PlacarStore } from "./store";
import type { Benchmark, PlacarClient, PlacarEntry, PlacarTask, RodadaRow, RodadaTone, Tier } from "./types";

/** Rodadas que o mapa da carteira mostra no histórico de cada cliente. */
const TRAIL = 8;
/** Status das tarefas é relido do ClickUp no máximo a cada 10 minutos. */
const SYNC_MS = 10 * 60_000;

export interface RodadaClient extends RodadaRow {
  name: string;
  meta: string | null;
  greenStreak: number;
  redStreak: number;
  /** Faixa nas últimas 8 rodadas, a mais antiga primeiro e esta por último. */
  trail: RodadaTone[];
  /** Custo por resultado ou retorno na janela ("R$ 18,40", "2,1x"); nulo sem leitura. */
  tierRead: string | null;
  /** O que falta para o próximo degrau; nulo em Ouro ou sem escada. */
  tierNext: string | null;
  /** Degrau na última rodada fechada que tinha degrau. */
  tierPrev: Tier;
  /** Rodadas seguidas (fechadas, contando esta) em Abaixo. */
  abaixoStreak: number;
}

export interface OwnerLine {
  owner: string;
  clients: number;
  green: number;
  points: number;
  avg: number;
  /** XP da rodada: a média × 10, sem vírgula. */
  xp: number;
  viradas: number;
  sequencias: number;
  /** Clientes que subiram de degrau nesta rodada. */
  degraus: number;
  quarter: number;
}

export interface RodadaTaskInfo {
  client: string;
  url: string;
  status: string;
  closed: boolean;
  escalated: boolean;
  week: string;
}

export interface SemanaSnapshot {
  week: string;
  closed: boolean;
  closedAt: string | null;
  rows: RodadaClient[];
  owners: OwnerLine[];
  team: { green: number; total: number; goal: number };
  tasks: RodadaTaskInfo[];
  clickup: boolean;
  /** Erro ao ler o ClickUp. A tela segue com o último status guardado. */
  clickupError: string | null;
  /** Rodada desta semana na temporada (null fora dela) e as semanas já fechadas da temporada. */
  season: { name: string; rounds: number; round: number | null; closedWeeks: string[] };
  /** Tabela da temporada até agora, só com rodadas fechadas. */
  table: SeasonLine[];
  /** Missões da semana em andamento, que nem sempre é a semana vista. */
  missionsWeek: string;
  missions: Mission[];
  launch: LaunchLine[];
}

// ---------- cálculo (puro) ----------

/** Nota e pontos de cada cliente ativo na rodada `week`, com a régua de hoje. */
/** Degrau congelado do cliente na última rodada fechada antes de `week` que tinha degrau. */
export function prevTierOf(frozen: RodadaRow[], client: string, week: string): Tier {
  let best: RodadaRow | null = null;
  for (const r of frozen) {
    if (r.client !== client || r.week >= week || !r.tier) continue;
    if (!best || r.week > best.week) best = r;
  }
  return best?.tier ?? "";
}

/** Rodadas fechadas seguidas em Abaixo antes de `week` (para o gatilho de 4 rodadas). */
function abaixoBefore(frozen: RodadaRow[], client: string, week: string): number {
  let n = 0;
  for (let i = 1; i < LOOKBACK; i++) {
    const w = addWeeks(week, -i);
    const r = frozen.find((x) => x.client === client && x.week === w);
    if (!r || r.tier !== "abaixo") break;
    n++;
  }
  return n;
}

export function computeRodada(
  clients: PlacarClient[],
  entries: PlacarEntry[],
  frozen: RodadaRow[],
  week: string,
  closedAt: string,
  benchmarks: Benchmark[] = [],
): RodadaClient[] {
  const toneAt = toneGetter(entries, frozen);
  const lists = byClient(entries);
  const ladder = buildLadder(clients, lists, benchmarks, week);
  const empty: ClientLadder = { read: null, tier: "", next: null, steps: [], market: null, cob: null, cobScope: null, group: 0 };
  // Sem rodada congelada antes (rodada 1, cliente novo), o ponto de partida é o degrau lido na semana anterior.
  let before: Map<string, ClientLadder> | null = null;
  const tierBefore = (id: string): Tier => {
    before ??= buildLadder(clients, lists, benchmarks, addWeeks(week, -1));
    return before.get(id)?.tier ?? "";
  };

  return clients
    .filter((c) => c.active)
    .map((c) => {
      const s = scoreFor(c, week, lists.get(c.id) ?? []);
      const tone = s.tone;
      const prev = toneAt(c, addWeeks(week, -1));
      // Sequência no verde só conta rodada da temporada: semana anterior ao início do jogo não vale selo.
      const greenStreak = tone === "good" ? Math.min(streak(toneAt, c, week, "good"), roundOf(week) ?? 0) : 0;
      const redStreak = tone === "bad" ? streak(toneAt, c, week, "bad") : 0;
      const l = ladder.get(c.id) ?? empty;
      const tierPrev = prevTierOf(frozen, c.id, week) || tierBefore(c.id);

      let points = 0;
      const badges: string[] = [];
      if (tone !== "none") points += POINTS.leitura;
      if (tone === "good") points += POINTS.verde;
      if (prev === "bad" && (tone === "good" || tone === "warn")) {
        points += POINTS.virada;
        badges.push("virada");
      }
      if (greenStreak > 0 && greenStreak % STREAK === 0) {
        points += POINTS.sequencia;
        badges.push("sequencia");
      }
      if (l.tier && tierPrev && TIER_RANK[l.tier] > TIER_RANK[tierPrev]) {
        points += POINTS.degrau;
        badges.push("degrau");
      }

      return {
        week,
        client: c.id,
        owner: c.owner.trim(),
        tone,
        score: s.final,
        points,
        badges,
        tier: l.tier,
        closed_at: closedAt,
        tierRead: l.read ? fmtRead(l.read.metric, l.read.value) : null,
        tierNext: nextText(l),
        tierPrev,
        abaixoStreak: l.tier === "abaixo" ? 1 + abaixoBefore(frozen, c.id, week) : 0,
        name: c.name,
        meta: metaText(c),
        greenStreak,
        redStreak,
        trail: Array.from({ length: TRAIL }, (_, i) => toneAt(c, addWeeks(week, i - TRAIL + 1))),
      };
    });
}

/** Ranking dos donos pela média de pontos por cliente. Sem dono fica fora. */
export function ownerBoard(rows: RodadaClient[], quarterRows: RodadaRow[]): OwnerLine[] {
  const quarter = new Map<string, number>();
  for (const r of quarterRows) if (r.owner) quarter.set(r.owner, (quarter.get(r.owner) ?? 0) + r.points);

  const lines = new Map<string, OwnerLine>();
  for (const r of rows) {
    if (!r.owner) continue;
    const l = lines.get(r.owner) ?? {
      owner: r.owner,
      clients: 0,
      green: 0,
      points: 0,
      avg: 0,
      xp: 0,
      viradas: 0,
      sequencias: 0,
      degraus: 0,
      quarter: quarter.get(r.owner) ?? 0,
    };
    l.clients++;
    if (r.tone === "good") l.green++;
    l.points += r.points;
    if (r.badges.includes("virada")) l.viradas++;
    if (r.badges.includes("sequencia")) l.sequencias++;
    if (r.badges.includes("degrau")) l.degraus++;
    lines.set(r.owner, l);
  }
  return [...lines.values()]
    .map((l) => {
      const avg = l.clients ? l.points / l.clients : 0;
      return { ...l, avg, xp: xpOf(avg) };
    })
    .sort((a, b) => b.avg - a.avg || b.points - a.points || a.owner.localeCompare(b.owner, "pt-BR"));
}

// ---------- ClickUp ----------

const prefix = () => process.env.PLACAR_TASK_PREFIX ?? "";

/** Tarefa do cliente que ficou 4 rodadas em Abaixo na escada do benchmark (docs/placar-benchmark.md). */
function degrauMarkdown(r: RodadaClient, origin: string): string {
  return [
    `**Cliente:** ${r.name} · **Dono:** ${r.owner || "sem dono"}`,
    `**Rodada:** ${weekLabel(r.week)} · **Degrau:** Abaixo há ${r.abaixoStreak} rodadas${r.tierRead ? ` (${r.tierRead})` : ""}`,
    `**Placar:** ${origin}/placar/semana?week=${r.week}`,
    "",
    "## Missão: subir um degrau",
    "",
    ...(r.tierNext ? [`- **Para chegar em Bronze:** ${r.tierNext.replace(/^subir para \w+: /, "")}`] : []),
    `- **Subir de degrau vale +${POINTS.degrau} pontos** para ${r.owner || "o time"} na rodada em que acontecer.`,
    "- A nota do cliente pode estar verde e o custo ainda assim acima da carteira: aqui o problema é eficiência, não volume.",
    "",
    "## Plano de 72h",
    "",
    "### Até 4h: diagnóstico de custo",
    "- [ ] O gasto e o resultado lidos estão certos (conta certa, evento certo)?",
    "- [ ] Onde o custo está acima: Meta, Google ou os dois (ficha do cliente no placar mostra os dois)",
    "- [ ] O que a carteira faz diferente nesse grupo: objetivo, criativo, página, público",
    "",
    "### Até 24h: ação",
    "- [ ] Uma mudança no ar com o que foi feito e quando",
    "- [ ] A verba está certa para o custo-alvo? Se a meta de volume não fecha, revisar a verba com o cliente",
    "",
    "### Em 72h: revisão",
    "- [ ] Anotar aqui o custo depois da mudança",
    "- [ ] Se não mexeu, levar para a reunião de segunda: mudar escopo, dono ou grupo de comparação",
  ].join("\n");
}

function taskMarkdown(r: RodadaClient, origin: string, need: string | null): string {
  const nota = r.score === null ? "sem nota" : fmtScore(r.score);
  return [
    `**Cliente:** ${r.name} · **Dono:** ${r.owner || "sem dono"}`,
    `**Rodada:** ${weekLabel(r.week)} · **Nota:** ${nota}${r.meta ? ` (meta: ${r.meta})` : ""}`,
    `**Placar:** ${origin}/placar/semana?week=${r.week}`,
    "",
    "## Missão: virar o cliente",
    "",
    ...(need ? [`- **Para sair do vermelho nesta semana:** ${need.charAt(0).toLowerCase()}${need.slice(1)}`] : []),
    `- **Virada vale +${POINTS.virada + POINTS.leitura} pontos** para ${r.owner || "o time"} quando o cliente sair do vermelho na rodada seguinte.`,
    "- **Fechar esta tarefa em até 72h** desbloqueia a conquista Plano em 72h.",
    "",
    "O cliente só sai do vermelho pelo número lançado no placar. Fechar esta tarefa não muda a nota.",
    "Se o problema é tráfego, siga também o SOP de Conta Vermelha: https://app.clickup.com/t/86ag60u73",
    "",
    "## Plano de 72h",
    "",
    "### Até 4h: diagnóstico",
    "- [ ] O número lançado está certo? Separar dado errado de problema real",
    "- [ ] Onde quebrou: verba, campanha, criativo, site ou comercial do cliente",
    "- [ ] O que mudou nas últimas semanas",
    "",
    "### Até 24h: ação e conversa com o cliente",
    "- [ ] Ação corretiva no ar, com o que foi feito e quando",
    "- [ ] Cliente avisado: o que estamos fazendo e até quando",
    "- [ ] A meta ainda faz sentido? Se não, revisar com o cliente",
    "",
    "### Em 72h: revisão",
    "- [ ] Anotar aqui o que foi feito e o resultado",
    "- [ ] Se não melhorou, levar para a reunião de segunda",
  ].join("\n");
}

const ESCALATION =
  "4 rodadas seguidas no vermelho. Vai para a reunião de segunda decidir: mudar o escopo, trocar o dono ou encerrar o contrato.";

/** Relê o status das tarefas abertas no ClickUp. Sem `force`, no máximo a cada 10 minutos. */
export async function syncTasks(store: PlacarStore, force = false): Promise<PlacarTask[]> {
  const tasks = await store.listTasks();
  const open = tasks.filter((t) => !t.closed);
  if (!clickupConfig() || !open.length) return tasks;
  const stale = open.some((t) => Date.now() - Date.parse(t.synced_at) > SYNC_MS);
  if (!force && !stale) return tasks;

  const states = await listTaskStates();
  const now = new Date().toISOString();
  const out: PlacarTask[] = [];
  for (const t of tasks) {
    if (t.closed) {
      out.push(t);
      continue;
    }
    const s = states.get(t.id);
    // Sumiu da lista (apagada, arquivada ou movida): conta como fechada.
    const next = s
      ? { ...t, status: s.status, closed: s.closed, closed_at: s.closedAt, url: s.url || t.url, synced_at: now }
      : { ...t, status: "fora da lista", closed: true, closed_at: null, synced_at: now };
    out.push(await store.putTask(next));
  }
  return out;
}

/**
 * Garante a tarefa de um cliente vermelho: cria se não há nenhuma aberta e,
 * na quarta rodada seguida no vermelho, escala a aberta uma vez.
 */
/** Tarefa "Plano de degrau" para quem está 4 rodadas em Abaixo. Uma aberta por cliente, como a do vermelho. */
export async function ensureDegrauTask(store: PlacarStore, r: RodadaClient, tasks: PlacarTask[], origin: string): Promise<"criada" | "ja-existe"> {
  const now = new Date().toISOString();
  if (tasks.some((t) => t.client === r.client && !t.closed)) return "ja-existe";
  const t = await createTask({
    name: `${prefix()}🟠 Plano de degrau: ${r.name}`,
    markdown: degrauMarkdown(r, origin),
    assignee: clickupUserFor(r.owner),
    dueInHours: 72,
  });
  const saved = await store.putTask({
    id: t.id,
    client: r.client,
    week: r.week,
    url: t.url,
    status: t.status,
    closed: false,
    closed_at: null,
    escalated_at: null,
    created_at: now,
    synced_at: now,
  });
  tasks.push(saved);
  return "criada";
}

export async function ensureRedTask(
  store: PlacarStore,
  r: RodadaClient,
  tasks: PlacarTask[],
  origin: string,
  /** O que lançar para sair do vermelho (needToReach), vai na tarefa. */
  need: string | null = null,
): Promise<"criada" | "escalada" | "ja-existe"> {
  const now = new Date().toISOString();
  const open = tasks.find((t) => t.client === r.client && !t.closed);
  const mustEscalate = r.redStreak >= STREAK;

  if (open) {
    if (!mustEscalate || open.escalated_at) return "ja-existe";
    await escalateTask(open.id, ESCALATION);
    const saved = await store.putTask({ ...open, escalated_at: now });
    tasks.splice(tasks.indexOf(open), 1, saved);
    return "escalada";
  }

  const t = await createTask({
    name: `${prefix()}🔴 Plano de recuperação: ${r.name}`,
    markdown: taskMarkdown(r, origin, need),
    assignee: clickupUserFor(r.owner),
    dueInHours: 72,
  });
  if (mustEscalate) await escalateTask(t.id, ESCALATION);
  const saved = await store.putTask({
    id: t.id,
    client: r.client,
    week: r.week,
    url: t.url,
    status: t.status,
    closed: false,
    closed_at: null,
    escalated_at: mustEscalate ? now : null,
    created_at: now,
    synced_at: now,
  });
  tasks.push(saved);
  return "criada";
}

// ---------- leitura e fechamento ----------

async function load(store: PlacarStore, week: string) {
  const from = addWeeks(week, -(LOOKBACK + 4));
  const [clients, entries, frozen, benchmarks] = await Promise.all([
    store.listClients(),
    store.listEntries(from),
    store.listRodada(from < QUARTER_START ? from : QUARTER_START),
    store.listBenchmarks(),
  ]);
  return { clients, entries, frozen, benchmarks };
}

/** A rodada `week` como a tela mostra: congelada se já fechou, prévia se não. */
export async function semanaSnapshot(store: PlacarStore, week: string): Promise<SemanaSnapshot> {
  let clickupError: string | null = null;
  const [{ clients, entries, frozen, benchmarks }, tasks, pedidos] = await Promise.all([
    load(store, week),
    syncTasks(store).catch((e: unknown) => {
      clickupError = e instanceof Error ? e.message : String(e);
      return store.listTasks();
    }),
    store.listPedidos(currentMonth()),
  ]);
  const fixed = frozen.filter((r) => r.week === week);
  const closed = fixed.length > 0;
  const live = computeRodada(clients, entries, frozen, week, new Date().toISOString(), benchmarks);

  let rows: RodadaClient[];
  if (closed) {
    // Rodada fechada: nota, dono e pontos vêm do congelado; nome e sequências, de agora.
    const byId = new Map(live.map((r) => [r.client, r]));
    const names = new Map(clients.map((c) => [c.id, c.name]));
    rows = fixed.map((f) => {
      const l = byId.get(f.client);
      return {
        ...f,
        name: names.get(f.client) ?? f.client,
        meta: l?.meta ?? null,
        greenStreak: l?.greenStreak ?? 0,
        redStreak: l?.redStreak ?? 0,
        trail: l?.trail ?? [],
        tierRead: l?.tierRead ?? null,
        tierNext: l?.tierNext ?? null,
        tierPrev: l?.tierPrev ?? "",
        abaixoStreak: l?.abaixoStreak ?? 0,
      };
    });
  } else {
    rows = live;
  }

  const quarterRows = frozen.filter((r) => r.week >= QUARTER_START && r.week <= week);
  const missionsWeek = mondayOf(new Date());
  const { missions, launch } = weekMissions(clients, entries, frozen, missionsWeek, benchmarks, pedidos);
  const owners = [...new Set(clients.filter((c) => c.active).map((c) => c.owner.trim()))];
  return {
    week,
    closed,
    closedAt: closed ? fixed[0].closed_at : null,
    rows,
    owners: ownerBoard(rows, quarterRows),
    team: { green: rows.filter((r) => r.tone === "good").length, total: rows.length, goal: TEAM_GOAL },
    tasks: tasks.map((t) => ({
      client: t.client,
      url: t.url,
      status: t.status,
      closed: t.closed,
      escalated: Boolean(t.escalated_at),
      week: t.week,
    })),
    clickup: Boolean(clickupConfig()),
    clickupError,
    season: {
      name: SEASON.name,
      rounds: SEASON.rounds,
      round: roundOf(week),
      closedWeeks: [...new Set(frozen.map((r) => r.week))].filter((w) => roundOf(w) !== null).sort(),
    },
    table: seasonTable(frozen, tasks, owners),
    missionsWeek,
    missions,
    launch,
  };
}

/** O que lançar nesta semana para `client` sair do vermelho, para a tarefa do ClickUp. */
export function needForTask(c: PlacarClient | undefined, entries: PlacarEntry[]): string | null {
  if (!c) return null;
  return needToReach(c, byClient(entries).get(c.id) ?? [], mondayOf(new Date()), 4).todo;
}

export interface CloseResult {
  week: string;
  already: boolean;
  saved: number;
  reds: number;
  /** Clientes 4 rodadas em Abaixo na escada (tarefa de degrau). */
  lows: number;
  tasks: Record<string, string>;
  taskError: string | null;
}

/**
 * Fecha a rodada `week`: congela as notas e cuida das tarefas dos vermelhos.
 * Rodar de novo não mexe nas notas congeladas; só cria a tarefa que tenha faltado.
 */
export async function closeWeek(store: PlacarStore, week: string, origin: string): Promise<CloseResult> {
  // Semana anterior ao início da temporada não congela: o jogo começa em QUARTER_START.
  if (week < QUARTER_START) return { week, already: false, saved: 0, reds: 0, lows: 0, tasks: {}, taskError: null };
  const { clients, entries, frozen, benchmarks } = await load(store, week);
  const already = frozen.some((r) => r.week === week);
  const now = new Date().toISOString();

  let rows: RodadaClient[];
  let saved = 0;
  if (already) {
    rows = computeRodada(clients, entries, frozen, week, now, benchmarks).filter((r) =>
      frozen.some((f) => f.week === week && f.client === r.client && f.tone === "bad"),
    );
  } else {
    rows = computeRodada(clients, entries, frozen, week, now, benchmarks);
    saved = await store.insertRodada(
      rows.map(({ week: w, client, owner, tone, score, points, badges, tier, closed_at }) => ({
        week: w,
        client,
        owner,
        tone,
        score,
        points,
        badges,
        tier,
        closed_at,
      })),
    );
  }

  const reds = rows.filter((r) => r.tone === "bad");
  // Abaixo por 4 rodadas fechadas seguidas abre tarefa de degrau (só quando não está vermelho, que já tem a dele).
  const lows = rows.filter((r) => r.tone !== "bad" && r.abaixoStreak >= STREAK);
  const result: CloseResult = { week, already, saved, reds: reds.length, lows: lows.length, tasks: {}, taskError: null };
  if ((!reds.length && !lows.length) || !clickupConfig()) return result;

  try {
    const tasks = await syncTasks(store, true);
    const byId = new Map(clients.map((c) => [c.id, c]));
    for (const r of reds) {
      result.tasks[r.name] = await ensureRedTask(store, r, tasks, origin, needForTask(byId.get(r.client), entries));
    }
    for (const r of lows) {
      result.tasks[r.name] = await ensureDegrauTask(store, r, tasks, origin);
    }
  } catch (e) {
    // A rodada já está congelada; tarefa que falhou sai de novo no botão ou no próximo fechamento.
    result.taskError = e instanceof Error ? e.message : String(e);
  }
  return result;
}
