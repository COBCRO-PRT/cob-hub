"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Award, Play, TrendingUp } from "lucide-react";
import { LEVELS, POINTS, STREAK } from "@/lib/placar/rodada-rules";
import type { Mission } from "@/lib/placar/jogo";
import type { RodadaClient, RodadaTaskInfo, SemanaSnapshot } from "@/lib/placar/rodada";
import { addWeeks, lastClosedWeek, mondayOf, weekLabel } from "@/lib/placar/score";
import { btnGhost, btnPrimary, TONE_STYLE } from "./tones";
import { Empty, Notice, ScoreBadge, SectionTitle } from "./semana/comum";
import { ClientMap, Missions, PersonFilter, matches } from "./semana/Missoes";
import { Confetti, Reveal } from "./semana/Revelacao";
import { Conquistas, Podium, SeasonTable, SeasonTrack, TeamGoal } from "./semana/Temporada";

const REFRESH_MS = 60_000;

type Snapshot = SemanaSnapshot & { canClose: boolean };
type LoadState = "loading" | "ok" | "error" | "auth";

const subscribeNoop = () => () => {};
const useMounted = () => useSyncExternalStore(subscribeNoop, () => true, () => false);

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

// A revelação toca uma vez por rodada em cada navegador. Sem localStorage, toca toda vez.
const seenKey = (week: string) => `cob-placar-revelacao-${week}`;
function wasSeen(week: string) {
  try {
    return window.localStorage.getItem(seenKey(week)) === "1";
  } catch {
    return false;
  }
}
function markSeen(week: string) {
  try {
    window.localStorage.setItem(seenKey(week), "1");
  } catch {
    // navegação privada: segue sem lembrar
  }
}

const missionKey = (m: Mission) => `${m.client}_${m.kind}`;

export function SemanaBoard({ who, admin = false }: { who?: string; admin?: boolean }) {
  const mounted = useMounted();
  const [pickedWeek, setPickedWeek] = useState<string | null>(null);
  const week = pickedWeek ?? (mounted ? lastClosedWeek() : null);
  const currentMonday = mounted ? mondayOf(new Date()) : null;

  const [data, setData] = useState<Snapshot | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [reveal, setReveal] = useState(false);
  const [burst, setBurst] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const seq = useRef(0);
  const doneBefore = useRef<{ week: string; keys: Set<string> } | null>(null);

  // A semana vem da URL (?week=) quando o link sai de uma tarefa do ClickUp.
  useEffect(() => {
    const w = new URLSearchParams(window.location.search).get("week");
    if (w) setTimeout(() => setPickedWeek(w), 0);
  }, []);

  const openReveal = useCallback((w: string) => {
    markSeen(w);
    setReveal(true);
  }, []);

  const load = useCallback(async () => {
    if (!week) return;
    const mine = ++seq.current;
    try {
      const res = await fetch(`/api/placar/semana?week=${week}`, { cache: "no-store" });
      const body = await res.json().catch(() => null);
      if (mine !== seq.current) return;
      if (res.status === 401) {
        setState("auth");
        return;
      }
      if (!res.ok || !body?.ok) {
        setErrorMsg(body?.error ?? `O servidor respondeu ${res.status}.`);
        setState("error");
        return;
      }
      const snap = body as Snapshot;

      // Missão que virou cumprida desde a última leitura ganha festa.
      const keys = new Set(snap.missions.filter((m) => m.done).map(missionKey));
      const before = doneBefore.current;
      if (before && before.week === snap.missionsWeek) {
        const fresh = snap.missions.filter((m) => m.done && !before.keys.has(missionKey(m)));
        if (fresh.length) {
          setBurst(Date.now());
          setToast(
            fresh.length === 1
              ? `Missão cumprida: ${fresh[0].name} (+${fresh[0].points})`
              : `${fresh.length} missões cumpridas (+${fresh.reduce((n, m) => n + m.points, 0)})`,
          );
        }
      }
      doneBefore.current = { week: snap.missionsWeek, keys };

      setData(snap);
      setState("ok");
      if (snap.closed && snap.rows.length && !wasSeen(snap.week)) openReveal(snap.week);
    } catch {
      if (mine !== seq.current) return;
      setErrorMsg("Sem conexão com o servidor.");
      setState("error");
    }
  }, [week, openReveal]);

  useEffect(() => {
    if (!week) return;
    const first = setTimeout(load, 0);
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [load, week]);

  // Link do menu rápido (#missoes, #mapa, #temporada) só acha a seção depois que a rodada carrega.
  const hashDone = useRef(false);
  useEffect(() => {
    if (!data || hashDone.current) return;
    hashDone.current = true;
    const id = window.location.hash.slice(1);
    if (id) setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: "start" }), 50);
  }, [data]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  async function post(path: string, payload: unknown, key: string, ok: (b: Record<string, unknown>) => string, after?: () => void) {
    setBusy(key);
    setActionMsg(null);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const b = await res.json().catch(() => null);
      const good = res.ok && b?.ok;
      if (!good) setActionMsg({ tone: "bad", text: b?.error ?? `O servidor respondeu ${res.status}.` });
      else setActionMsg({ tone: "ok", text: ok(b) });
      await load();
      if (good) after?.();
    } catch {
      setActionMsg({ tone: "bad", text: "Sem conexão com o servidor." });
    } finally {
      setBusy(null);
    }
  }

  const closeNow = () =>
    week &&
    post(
      "/api/placar/rodada",
      { week },
      "close",
      (b) => {
        const tasks = Object.keys((b.tasks as Record<string, string>) ?? {}).length;
        return `Rodada fechada: ${b.saved} clientes congelados, ${b.reds} no vermelho${tasks ? `, ${tasks} tarefas conferidas no ClickUp` : ""}.${b.taskError ? ` ClickUp falhou: ${b.taskError}` : ""}`;
      },
      () => openReveal(week),
    );

  const createTask = (r: RodadaClient) =>
    post("/api/placar/tasks", { client: r.client, week: r.week }, r.client, (b) =>
      b.result === "criada" ? `Tarefa criada no ClickUp para ${r.name}.` : b.result === "escalada" ? `Tarefa de ${r.name} escalada.` : `${r.name} já tinha tarefa aberta.`,
    );

  const rows = data?.rows ?? [];
  const owners = data ? data.table.map((l) => l.owner).sort((a, b) => a.localeCompare(b, "pt-BR")) : [];
  // Quem cuida de carteira abre nas próprias missões; o Matheus abre no time todo.
  const person = picked ?? (!admin && who && owners.includes(who) ? who : "todos");
  const levels = new Map((data?.table ?? []).map((l) => [l.owner, l]));
  const reds = rows
    .filter((r) => r.tone === "bad" && matches(person, r.owner))
    .sort((a, b) => b.redStreak - a.redStreak || a.name.localeCompare(b.name, "pt-BR"));
  const viradas = rows.filter((r) => r.badges.includes("virada"));
  const prontos = rows.filter((r) => r.greenStreak >= STREAK);
  const pick = (o: string) => {
    setPicked(o);
    document.getElementById("missoes")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen bg-[#07080a]">
      <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-7 px-4 pb-24 pt-8 sm:px-6 lg:px-8">

        <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div className="flex min-w-0 flex-col gap-2">
            <span className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-500">
              <i aria-hidden className="inline-block size-2.5 rounded-[2px] bg-[#00e5ff]" />
              COB · gestão por resultado
            </span>
            <h1 className="text-[clamp(26px,4vw,34px)] font-extrabold leading-none tracking-[-0.03em] text-white">
              Rodada da semana
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2" aria-label="Semana da rodada">
            <button
              type="button"
              aria-label="Rodada anterior"
              disabled={!week}
              onClick={() => week && setPickedWeek(addWeeks(week, -1))}
              className={`${btnGhost} size-9 px-0 text-[16px]`}
            >
              ‹
            </button>
            <div className="flex min-w-[148px] flex-col items-center px-1">
              <b className="font-mono text-[15px] font-semibold tabular-nums text-white">{week ? weekLabel(week) : "…"}</b>
              <span className="text-[11.5px] text-zinc-500">
                {!data ? "…" : data.closed ? `fechada em ${fmtDateTime(data.closedAt ?? "")}` : "prévia, fecha segunda às 10h"}
              </span>
            </div>
            <button
              type="button"
              aria-label="Próxima rodada"
              disabled={!week || !currentMonday || week >= currentMonday}
              onClick={() => week && setPickedWeek(addWeeks(week, 1))}
              className={`${btnGhost} size-9 px-0 text-[16px]`}
            >
              ›
            </button>
            {data?.closed && rows.length > 0 && (
              <button type="button" onClick={() => openReveal(data.week)} className={`${btnGhost} h-9 gap-1.5`}>
                <Play aria-hidden className="size-3.5" /> Rever a revelação
              </button>
            )}
            {data?.canClose && (
              <button type="button" onClick={closeNow} disabled={busy !== null} className={`${btnPrimary} h-9`}>
                {busy === "close" ? "Fechando…" : "Fechar rodada agora"}
              </button>
            )}
          </div>
        </header>

        {data && week && <SeasonTrack season={data.season} week={week} live={data.missionsWeek} />}

        {actionMsg && (
          <p
            role="status"
            className={`rounded-lg border px-4 py-2.5 text-[13px] ${actionMsg.tone === "ok" ? "border-[#00e5ff]/25 bg-[#00e5ff]/[0.05] text-[#7ff2ff]" : "border-red-500/25 bg-red-500/[0.06] text-red-400"}`}
          >
            {actionMsg.text}
          </p>
        )}

        {state === "auth" && <Notice title="Sua sessão expirou">Recarregue a página para entrar de novo.</Notice>}
        {state === "error" && <Notice title="Não deu para ler a rodada">{errorMsg}</Notice>}
        {data?.clickupError && (
          <Notice title="Não deu para ler o ClickUp agora">
            O status das tarefas abaixo é o último guardado. {data.clickupError}
          </Notice>
        )}

        {!data ? (
          state === "loading" && <Empty>Carregando a rodada…</Empty>
        ) : !rows.length ? (
          <Empty>Nenhum cliente nesta rodada.</Empty>
        ) : (
          <>
            <TeamGoal green={data.team.green} total={data.team.total} />

            <div className="grid gap-5 lg:grid-cols-2">
              <section aria-label="Pódio da rodada" className="flex flex-col gap-4 rounded-2xl border border-white/8 bg-white/[0.01] px-5 py-4">
                <SectionTitle right={data.closed ? "rodada fechada" : "prévia, ainda muda"}>Pódio da rodada</SectionTitle>
                {data.owners.length ? (
                  <Podium owners={data.owners} levels={levels} onPick={pick} />
                ) : (
                  <Empty>Nenhum cliente com dono nesta rodada.</Empty>
                )}
              </section>
              <section id="temporada" aria-label="Tabela da temporada" className="flex scroll-mt-20 flex-col gap-4 rounded-2xl border border-white/8 bg-white/[0.01] px-5 py-4">
                <SectionTitle right="só rodada fechada soma">Tabela da temporada</SectionTitle>
                <SeasonTable table={data.table} picked={person} onPick={pick} />
              </section>
            </div>

            {(viradas.length > 0 || prontos.length > 0) && (
              <div className="grid gap-5 lg:grid-cols-2">
                <section aria-label="Viradas" className="flex flex-col gap-3">
                  <SectionTitle>Viradas · saíram do vermelho (+{POINTS.virada})</SectionTitle>
                  {viradas.length ? (
                    <ul className="flex flex-col gap-2">
                      {viradas.map((r) => (
                        <Highlight key={r.client} row={r} icon="virada" note={`agora ${TONE_STYLE[r.tone].label.toLowerCase()}`} />
                      ))}
                    </ul>
                  ) : (
                    <Empty>Nenhuma virada nesta rodada.</Empty>
                  )}
                </section>
                <section aria-label="Prontos para indicação" className="flex flex-col gap-3">
                  <SectionTitle>Prontos para indicação · {STREAK}+ rodadas no verde</SectionTitle>
                  {prontos.length ? (
                    <ul className="flex flex-col gap-2">
                      {prontos.map((r) => (
                        <Highlight
                          key={r.client}
                          row={r}
                          icon="selo"
                          note={`${r.greenStreak} rodadas no verde: pedir indicação e propor aumento`}
                        />
                      ))}
                    </ul>
                  ) : (
                    <Empty>Ninguém com {STREAK} rodadas seguidas no verde ainda.</Empty>
                  )}
                </section>
              </div>
            )}

            <div id="missoes" className="flex scroll-mt-20 flex-col gap-3 border-t border-white/8 pt-6">
              <SectionTitle>Ver por pessoa</SectionTitle>
              <PersonFilter owners={owners} picked={person} onPick={setPicked} />
            </div>

            <Missions missions={data.missions} launch={data.launch} week={data.missionsWeek} picked={person} />

            <section aria-label="Clientes no vermelho" className="flex flex-col gap-3">
              <SectionTitle>No vermelho · plano de recuperação no ClickUp ({reds.length})</SectionTitle>
              {!data.clickup && (
                <p className="text-[13px] text-amber-300/90">
                  O ClickUp ainda não está ligado no servidor, então as tarefas não são criadas.
                </p>
              )}
              {reds.length ? (
                <div className="flex flex-col gap-2">
                  {reds.map((r) => (
                    <RedRow
                      key={r.client}
                      row={r}
                      task={taskFor(data.tasks, r.client)}
                      mission={data.missions.find((m) => m.client === r.client && !m.done) ?? null}
                      canCreate={data.clickup}
                      busy={busy === r.client}
                      disabled={busy !== null}
                      onCreate={() => createTask(r)}
                    />
                  ))}
                </div>
              ) : (
                <Empty>Nenhum cliente no vermelho nesta rodada.</Empty>
              )}
            </section>

            <div id="mapa" className="scroll-mt-20">
              <ClientMap rows={rows} picked={person} missions={data.missions} tasks={data.tasks} />
            </div>

            <Conquistas table={data.table} />

            <Rules />
          </>
        )}
      </div>

      <AnimatePresence>{reveal && data && <Reveal data={data} onClose={() => setReveal(false)} />}</AnimatePresence>
      <Confetti seed={burst} pieces={60} />
      <AnimatePresence>
        {toast && (
          <motion.p
            role="status"
            className="fixed bottom-6 left-1/2 z-[55] -translate-x-1/2 rounded-full bg-emerald-400 px-5 py-2.5 text-[14px] font-semibold text-[#04141a] shadow-xl"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
          >
            {toast}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

/** A tarefa aberta do cliente; sem aberta, a mais recente. */
function taskFor(tasks: RodadaTaskInfo[], client: string): RodadaTaskInfo | undefined {
  const mine = tasks.filter((t) => t.client === client);
  return mine.find((t) => !t.closed) ?? mine[mine.length - 1];
}

function Highlight({ row, note, icon }: { row: RodadaClient; note: string; icon: "virada" | "selo" }) {
  const Icon = icon === "virada" ? TrendingUp : Award;
  return (
    <li className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.015] px-4 py-3">
      <ScoreBadge tone={row.tone} score={row.score} />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[14px] font-medium text-white">{row.name}</span>
        <span className="text-[12.5px] text-zinc-500">
          {row.owner || "sem dono"} · {note}
        </span>
      </div>
      <Icon aria-hidden className={`size-5 shrink-0 ${icon === "virada" ? "text-emerald-300" : "text-[#00e5ff]"}`} />
    </li>
  );
}

function RedRow({
  row,
  task,
  mission,
  canCreate,
  busy,
  disabled,
  onCreate,
}: {
  row: RodadaClient;
  task: RodadaTaskInfo | undefined;
  mission: Mission | null;
  canCreate: boolean;
  busy: boolean;
  disabled: boolean;
  onCreate: () => void;
}) {
  const open = task && !task.closed;
  const decide = row.redStreak >= STREAK;
  return (
    <div
      className={`flex flex-wrap items-center gap-x-4 gap-y-2.5 rounded-xl border px-4 py-3 ${decide ? "border-red-500/40 bg-red-500/[0.05]" : "border-white/8 bg-white/[0.015]"}`}
    >
      <ScoreBadge tone={row.tone} score={row.score} />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[14px] font-medium text-white">{row.name}</span>
        <span className="text-[12.5px] text-zinc-500">
          {row.owner || "sem dono"}
          {row.meta ? ` · meta ${row.meta}` : ""} ·{" "}
          {decide ? (
            <b className="font-semibold text-red-400">{row.redStreak} rodadas no vermelho: decidir na reunião</b>
          ) : row.redStreak > 1 ? (
            `${row.redStreak}ª rodada seguida no vermelho`
          ) : (
            "primeira rodada no vermelho"
          )}
        </span>
        {mission && (
          <span className={`mt-0.5 text-[12.5px] ${mission.blocked ? "text-amber-300" : "text-zinc-300"}`}>
            Missão da semana (+{mission.points}): {mission.todo.charAt(0).toLowerCase() + mission.todo.slice(1)}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {task && (
          <a href={task.url} target="_blank" rel="noreferrer" className={`${btnGhost} h-8`}>
            {open ? `Tarefa: ${task.status || "aberta"}` : "Tarefa fechada"}
            {task.escalated ? " · escalada" : ""}
          </a>
        )}
        {!open && canCreate && (
          <button type="button" onClick={onCreate} disabled={disabled} className={`${btnPrimary} h-8`}>
            {busy ? "Criando…" : task ? "Criar nova tarefa" : "Criar tarefa"}
          </button>
        )}
      </div>
    </div>
  );
}

function Rules() {
  const items = [
    [`+${POINTS.leitura}`, "cliente com leitura (tem meta e número)"],
    [`+${POINTS.verde}`, "cliente no verde"],
    [`+${POINTS.virada}`, "virada: saiu do vermelho para amarelo ou verde"],
    [`+${POINTS.sequencia}`, `a cada ${STREAK} rodadas seguidas no verde (selo de indicação)`],
  ];
  return (
    <section aria-label="Como pontua" className="flex flex-col gap-2 border-t border-white/8 pt-5">
      <SectionTitle>Como pontua</SectionTitle>
      <ul className="flex flex-wrap gap-x-6 gap-y-1.5 text-[13px] text-zinc-400">
        {items.map(([p, t]) => (
          <li key={t}>
            <b className="font-mono font-semibold text-white">{p}</b> {t}
          </li>
        ))}
      </ul>
      <p className="text-[12.5px] leading-relaxed text-zinc-500">
        Não existe ponto negativo. XP da rodada é a média de pontos por cliente × 10, para carteira grande não ganhar só
        pelo tamanho. O XP das rodadas fechadas soma na temporada e sobe o nível:{" "}
        {LEVELS.map((l) => `${l.name} (${l.from})`).join(", ")}. A rodada fecha na segunda às 10h e a nota fica congelada.
        Vermelho vira tarefa no ClickUp com prazo de 72h, e quem tira o cliente do vermelho é o número, não a tarefa fechada.
      </p>
    </section>
  );
}
