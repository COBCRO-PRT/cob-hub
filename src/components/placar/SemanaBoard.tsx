"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AnimatePresence } from "motion/react";
import { ArrowUpRight, Award, Play, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { Button, CONTAINER, Empty, Notice, Pill, Score as Ring, SectionTitle, Skeleton, Surface } from "@/components/ui";
import { PageHeader } from "./PageHeader";
import { LEVELS, POINTS, STREAK } from "@/lib/placar/rodada-rules";
import type { Mission } from "@/lib/placar/jogo";
import type { RodadaClient, RodadaTaskInfo, SemanaSnapshot } from "@/lib/placar/rodada";
import { addWeeks, lastClosedWeek, mondayOf, weekLabel } from "@/lib/placar/score";
import { cn } from "@/lib/utils";
import { EXTERNAL_LINK, TONE_LABEL, closesAt, useNow } from "./semana/comum";
import { ClientMap, Missions, PersonFilter, matches } from "./semana/Missoes";
import { Confetti, Reveal } from "./semana/Revelacao";
import { Conquistas, SeasonTable, SeasonTrack, TeamGoal } from "./semana/Temporada";

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
  const [picked, setPicked] = useState<string | null>(null);
  const [reveal, setReveal] = useState(false);
  const [burst, setBurst] = useState(0);
  const seq = useRef(0);
  const doneBefore = useRef<{ week: string; keys: Set<string> } | null>(null);
  // Um relógio só para os prazos das tarefas.
  const now = useNow();

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

      // Missão que virou cumprida desde a última leitura ganha festa: toast e confete por cima.
      const keys = new Set(snap.missions.filter((m) => m.done).map(missionKey));
      const before = doneBefore.current;
      if (before && before.week === snap.missionsWeek) {
        const fresh = snap.missions.filter((m) => m.done && !before.keys.has(missionKey(m)));
        if (fresh.length) {
          setBurst(Date.now());
          toast.success(
            fresh.length === 1 ? "Missão cumprida" : `${fresh.length} missões cumpridas`,
            { description: fresh.length === 1 ? `${fresh[0].name} (+${fresh[0].points})` : `+${fresh.reduce((n, m) => n + m.points, 0)} pontos`, duration: 6000 },
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

  async function post(path: string, payload: unknown, key: string, ok: (b: Record<string, unknown>) => string, after?: () => void) {
    setBusy(key);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const b = await res.json().catch(() => null);
      const good = res.ok && b?.ok;
      if (!good) toast.error("Não deu para concluir", { description: b?.error ?? `O servidor respondeu ${res.status}.` });
      else toast.success(ok(b));
      await load();
      if (good) after?.();
    } catch {
      toast.error("Sem conexão com o servidor.");
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
    <div className="min-h-screen bg-bg">
      <div className={`${CONTAINER} flex flex-col gap-10`}>
        <div className="flex flex-col gap-7">
          <PageHeader
            eyebrow="COB · gestão por resultado"
            title="Rodada da semana"
            week={{
              ariaLabel: "Semana da rodada",
              label: week ? weekLabel(week) : "…",
              hint: !data ? "lendo a rodada" : data.closed ? `fechada em ${fmtDateTime(data.closedAt ?? "")}` : "prévia, fecha segunda às 10h",
              onPrev: () => week && setPickedWeek(addWeeks(week, -1)),
              onNext: () => week && setPickedWeek(addWeeks(week, 1)),
              prevDisabled: !week,
              nextDisabled: !week || !currentMonday || week >= currentMonday,
            }}
            actions={
              data?.canClose ? (
                <Button size="sm" variant="primary" onClick={closeNow} disabled={busy !== null} pending={busy === "close"}>
                  Fechar rodada agora
                </Button>
              ) : undefined
            }
          />

          {data && week && <SeasonTrack season={data.season} week={week} live={data.missionsWeek} />}

          {state === "auth" && (
            <Notice tone="warn" title="Sua sessão expirou" action={<Button size="sm" onClick={() => window.location.reload()}>Entrar de novo</Button>}>
              Recarregue a página para entrar de novo.
            </Notice>
          )}
          {state === "error" && (
            <Notice tone="bad" title={data ? "Não deu para atualizar a rodada agora" : "Não deu para ler a rodada"} action={<Button size="sm" variant="danger" onClick={load}>Tentar de novo</Button>}>
              {errorMsg} {data ? "Mostrando a última leitura." : ""}
            </Notice>
          )}
          {data?.clickupError && (
            <Notice tone="warn" title="Não deu para ler o ClickUp agora">
              O status das tarefas abaixo é o último guardado. {data.clickupError}
            </Notice>
          )}
        </div>

        {!data ? (
          state === "loading" && <SemanaSkeleton />
        ) : !rows.length ? (
          <Empty title="Nenhum cliente nesta rodada" text="A rodada lê o placar da semana. Lance os números para ela aparecer aqui." action={<Button href="/placar">Lançar no placar</Button>} />
        ) : (
          <>
            <section aria-label="Meta do time e pódio" className="flex flex-col gap-4">
              <SectionTitle
                title="Meta do time"
                hint="A carteira inteira no verde até janeiro; o pódio é a rodada em tela."
                right={<Pill tone={data.closed ? "accent" : "neutral"}>{data.closed ? "rodada fechada" : "prévia, ainda muda"}</Pill>}
              />
              <TeamGoal green={data.team.green} total={data.team.total} owners={data.owners} levels={levels} onPick={pick} />
            </section>

            <section id="temporada" aria-label="Tabela da temporada" className="flex scroll-mt-20 flex-col gap-4">
              <SectionTitle title="Tabela da temporada" hint="Só rodada fechada soma. Toque numa pessoa para ver as missões dela." />
              <SeasonTable table={data.table} picked={person} onPick={pick} />
            </section>

            {(viradas.length > 0 || prontos.length > 0) && (
              <div className="grid gap-10 lg:grid-cols-2">
                <section aria-label="Viradas" className="flex flex-col gap-4">
                  <SectionTitle title="Viradas" hint={`Saíram do vermelho nesta rodada (+${POINTS.virada}).`} />
                  {viradas.length ? (
                    <ul className="flex flex-col gap-2">
                      {viradas.map((r) => (
                        <Highlight key={r.client} row={r} icon="virada" note={`agora ${TONE_LABEL[r.tone].toLowerCase()}`} />
                      ))}
                    </ul>
                  ) : (
                    <Empty title="Nenhuma virada nesta rodada" text="Tire um cliente do vermelho para ela aparecer aqui." />
                  )}
                </section>
                <section aria-label="Prontos para indicação" className="flex flex-col gap-4">
                  <SectionTitle title="Prontos para indicação" hint={`${STREAK} ou mais rodadas seguidas no verde.`} />
                  {prontos.length ? (
                    <ul className="flex flex-col gap-2">
                      {prontos.map((r) => (
                        <Highlight key={r.client} row={r} icon="selo" note={`${r.greenStreak} rodadas no verde: pedir indicação e propor aumento`} />
                      ))}
                    </ul>
                  ) : (
                    <Empty title={`Ninguém com ${STREAK} rodadas seguidas no verde ainda`} text="Segure o verde por quatro rodadas para liberar o selo." />
                  )}
                </section>
              </div>
            )}

            <section id="missoes" aria-label="Ver por pessoa" className="flex scroll-mt-20 flex-col gap-4">
              <SectionTitle title="Ver por pessoa" hint="Filtra as missões, os vermelhos e o mapa." />
              <PersonFilter owners={owners} picked={person} onPick={setPicked} />
            </section>

            <Missions missions={data.missions} launch={data.launch} week={data.missionsWeek} picked={person} />

            <section aria-label="Clientes no vermelho" className="flex flex-col gap-4">
              <SectionTitle title="No vermelho" hint={`Plano de recuperação no ClickUp, ${reds.length === 1 ? "1 cliente" : `${reds.length} clientes`}.`} />
              {!data.clickup && (
                <Notice tone="info">O ClickUp ainda não está ligado no servidor, então as tarefas não são criadas.</Notice>
              )}
              {reds.length ? (
                <ul className="flex flex-col gap-2">
                  {reds.map((r) => (
                    <RedRow
                      key={r.client}
                      row={r}
                      task={taskFor(data.tasks, r.client)}
                      mission={data.missions.find((m) => m.client === r.client && !m.done) ?? null}
                      canCreate={data.clickup}
                      now={now}
                      busy={busy === r.client}
                      disabled={busy !== null}
                      onCreate={() => createTask(r)}
                    />
                  ))}
                </ul>
              ) : (
                <Empty title="Nenhum cliente no vermelho nesta rodada" text="Quando um cliente cair abaixo de 4, ele aparece aqui com a tarefa." />
              )}
            </section>

            <div id="mapa" className="scroll-mt-20">
              <ClientMap rows={rows} picked={person} missions={data.missions} tasks={data.tasks} />
            </div>

            <section aria-label="Conquistas da temporada" className="flex flex-col gap-4">
              <SectionTitle title="Conquistas da temporada" hint="Não dão ponto, marcam o caminho." />
              <Conquistas table={data.table} />
            </section>

            <Rules />

            {data.closed && rows.length > 0 && (
              <div className="flex justify-center">
                <Button variant="link" onClick={() => openReveal(data.week)} icon={<Play aria-hidden strokeWidth={1.75} />}>
                  Rever a revelação
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      <AnimatePresence>{reveal && data && <Reveal data={data} onClose={() => setReveal(false)} />}</AnimatePresence>
      <Confetti seed={burst} pieces={60} />
    </div>
  );
}

/** Esqueleto com a forma da tela (§7): meta com pódio e quatro linhas da tabela. */
function SemanaSkeleton() {
  return (
    <div className="flex flex-col gap-10" aria-busy aria-label="Carregando a rodada">
      <div className="flex flex-col gap-4">
        <Skeleton className="w-40" />
        <Surface className="grid gap-8 p-5 sm:p-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-center">
          <div className="flex items-center gap-5">
            <div className="size-14 shrink-0 rounded-full bg-surface-2 motion-safe:animate-pulse" aria-hidden />
            <Skeleton lines={2} className="flex-1" />
          </div>
          <div className="flex items-end justify-center gap-2.5">
            {[80, 112, 56].map((h, i) => (
              <div key={i} className="w-[31%] max-w-[170px] rounded-t-md bg-surface-2 motion-safe:animate-pulse" style={{ height: h }} aria-hidden />
            ))}
          </div>
        </Surface>
      </div>
      <div className="flex flex-col gap-4">
        <Skeleton className="w-48" />
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Surface key={i} className="flex items-center gap-3 px-4 py-3">
              <Skeleton className="w-6" />
              <Skeleton lines={2} className="flex-1" />
            </Surface>
          ))}
        </div>
      </div>
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
    <Surface as="li" className="flex min-h-11 items-center gap-3 px-4 py-3">
      <Ring value={row.score} tone={row.tone} size={40} />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate type-subtitle text-fg">{row.name}</span>
        <span className="type-caption text-dim">
          {row.owner || "sem dono"} · {note}
        </span>
      </div>
      <Icon aria-hidden className={cn("size-[18px] shrink-0", icon === "virada" ? "text-good" : "text-accent-text")} strokeWidth={1.75} />
    </Surface>
  );
}

const DUE_MS = 72 * 3600_000;
const fmtDue = (ms: number) => new Date(ms).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/** Prazo da tarefa como chip: `warn` a menos de 24h, `bad` vencido. A tarefa nasce no fechamento da rodada e vence 72h depois. */
function Deadline({ task, now }: { task: RodadaTaskInfo; now: number | null }) {
  if (task.closed) return <Pill tone="good">tarefa fechada</Pill>;
  if (now === null) return null;
  const due = closesAt(task.week) + DUE_MS;
  const left = due - now;
  if (left <= 0) return <Pill tone="bad">venceu {fmtDue(due)}</Pill>;
  if (left < 24 * 3600_000) return <Pill tone="warn">vence em {Math.max(1, Math.floor(left / 3600_000))}h</Pill>;
  return <Pill>vence {fmtDue(due)}</Pill>;
}

function RedRow({
  row,
  task,
  mission,
  canCreate,
  now,
  busy,
  disabled,
  onCreate,
}: {
  row: RodadaClient;
  task: RodadaTaskInfo | undefined;
  mission: Mission | null;
  canCreate: boolean;
  now: number | null;
  busy: boolean;
  disabled: boolean;
  onCreate: () => void;
}) {
  const open = task && !task.closed;
  const decide = row.redStreak >= STREAK;
  return (
    <Surface
      as="li"
      className={cn(
        "relative flex min-h-11 flex-wrap items-center gap-x-4 gap-y-3 overflow-hidden px-4 py-3",
        decide && "before:absolute before:inset-y-3 before:left-0 before:w-0.5 before:rounded-r before:bg-bad before:content-['']",
      )}
    >
      <Ring value={row.score} tone={row.tone} size={40} />
      <div className="flex min-w-0 flex-1 basis-[200px] flex-col gap-0.5">
        <span className="truncate type-subtitle text-fg">{row.name}</span>
        <span className="type-caption text-dim">
          {row.owner || "sem dono"}
          {row.meta ? ` · meta ${row.meta}` : ""} ·{" "}
          {decide ? (
            <b className="font-semibold text-bad">{row.redStreak} rodadas no vermelho: decidir na reunião</b>
          ) : row.redStreak > 1 ? (
            `${row.redStreak}ª rodada seguida no vermelho`
          ) : (
            "primeira rodada no vermelho"
          )}
        </span>
        {mission && (
          <span className={cn("mt-0.5 type-body", mission.blocked ? "text-warn" : "text-mute")}>
            Missão da semana (+{mission.points}): {mission.todo.charAt(0).toLowerCase() + mission.todo.slice(1)}
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {task && <Deadline task={task} now={now} />}
        {task && (
          <Button variant="link" href={task.url} {...EXTERNAL_LINK} iconEnd={<ArrowUpRight aria-hidden strokeWidth={1.75} />}>
            {open ? `Tarefa: ${task.status || "aberta"}` : "Tarefa fechada"}
            {task.escalated ? " · escalada" : ""}
          </Button>
        )}
        {!open && canCreate && (
          <Button size="sm" variant="primary" onClick={onCreate} disabled={disabled} pending={busy}>
            {task ? "Criar nova tarefa" : "Criar tarefa"}
          </Button>
        )}
      </div>
    </Surface>
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
    <section aria-label="Como pontua" className="flex max-w-[760px] flex-col gap-3">
      <SectionTitle title="Como pontua" />
      <ul className="flex flex-wrap gap-x-6 gap-y-1.5 type-body text-mute">
        {items.map(([p, t]) => (
          <li key={t}>
            <b className="font-semibold tabular-nums text-fg">{p}</b> {t}
          </li>
        ))}
      </ul>
      <p className="max-w-[68ch] type-body text-mute">
        Não existe ponto negativo. XP da rodada é a média de pontos por cliente × 10, para carteira grande não ganhar só
        pelo tamanho. O XP das rodadas fechadas soma na temporada e sobe o nível:{" "}
        {LEVELS.map((l) => `${l.name} (${l.from})`).join(", ")}. A rodada fecha na segunda às 10h e a nota fica congelada.
        Vermelho vira tarefa no ClickUp com prazo de 72h, e quem tira o cliente do vermelho é o número, não a tarefa fechada.
      </p>
    </section>
  );
}
