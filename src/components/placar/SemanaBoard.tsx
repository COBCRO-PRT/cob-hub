"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AnimatePresence } from "motion/react";
import { ArrowUpRight, Play } from "lucide-react";
import { toast } from "sonner";
import { Button, CONTAINER, Empty, Notice, Pill, Score as Ring, SectionTitle, Skeleton, Surface } from "@/components/ui";
import { PageHeader } from "./PageHeader";
import { LEVELS, POINTS, STREAK, defaultRodadaWeek } from "@/lib/placar/rodada-rules";
import type { Mission } from "@/lib/placar/jogo";
import type { RodadaClient, RodadaTaskInfo, SemanaSnapshot } from "@/lib/placar/rodada";
import { addWeeks, mondayOf, weekLabel } from "@/lib/placar/score";
import { cn } from "@/lib/utils";
import { EXTERNAL_LINK, closesAt, plural, useNow } from "./semana/comum";
import { ClientMap, Missions, PersonFilter, matches } from "./semana/Missoes";
import { Confetti, Reveal } from "./semana/Revelacao";
import { Conquistas, PodiumCard, SeasonTable, SeasonTrack, TeamHero } from "./semana/Temporada";

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

/**
 * Rodada da semana na grade bento (D2.5): herói com a meta do time e pódio na linha 1,
 * missões e vermelhos na linha 2, mapa da carteira e tabela da temporada na linha 3,
 * conquistas e regras embaixo. No celular tudo vira uma coluna nessa mesma ordem.
 */
export function SemanaBoard({ who, admin = false }: { who?: string; admin?: boolean }) {
  const mounted = useMounted();
  const [pickedWeek, setPickedWeek] = useState<string | null>(null);
  const week = pickedWeek ?? (mounted ? defaultRodadaWeek() : null);
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
  const pick = (o: string) => {
    setPicked(o);
    document.getElementById("missoes")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen bg-bg">
      <div className={`${CONTAINER} flex flex-col gap-6`}>
        <div className="flex flex-col gap-5">
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
              <>
                {data?.closed && rows.length > 0 && (
                  <Button size="sm" onClick={() => openReveal(data.week)} icon={<Play aria-hidden strokeWidth={1.75} />}>
                    Rever a revelação
                  </Button>
                )}
                {data?.canClose && (
                  <Button size="sm" variant="primary" onClick={closeNow} disabled={busy !== null} pending={busy === "close"}>
                    Fechar rodada agora
                  </Button>
                )}
              </>
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
          <Empty
            title="Nenhum cliente nesta rodada"
            text="A rodada lê o placar da semana. Lance os números para ela aparecer aqui."
            action={
              <Button variant="soft" href="/placar">
                Lançar no placar
              </Button>
            }
          />
        ) : (
          <>
            <div className="grid grid-cols-12 gap-4">
              <TeamHero green={data.team.green} total={data.team.total} rows={rows} week={data.week} closed={data.closed} className="col-span-12 lg:col-span-7" />
              <PodiumCard owners={data.owners} levels={levels} onPick={pick} closed={data.closed} className="col-span-12 lg:col-span-5" />

              <Missions
                missions={data.missions}
                launch={data.launch}
                week={data.missionsWeek}
                picked={person}
                filter={<PersonFilter owners={owners} picked={person} onPick={setPicked} />}
                className="col-span-12 lg:col-span-8"
              />
              <RedList
                reds={reds}
                data={data}
                now={now}
                busy={busy}
                onCreate={createTask}
                className="col-span-12 lg:col-span-4"
              />

              <ClientMap rows={rows} picked={person} missions={data.missions} tasks={data.tasks} className="col-span-12 lg:col-span-8" />
              <SeasonTable table={data.table} picked={person} onPick={pick} className="col-span-12 lg:col-span-4" />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Conquistas table={data.table} />
              <Rules />
            </div>
          </>
        )}
      </div>

      <AnimatePresence>{reveal && data && <Reveal data={data} onClose={() => setReveal(false)} />}</AnimatePresence>
      <Confetti seed={burst} pieces={60} />
    </div>
  );
}

/** Esqueleto com a forma da grade bento (§7): herói com o medidor, pódio, cards de missão e a lista dos vermelhos. */
function SemanaSkeleton() {
  return (
    <div className="grid grid-cols-12 gap-4" aria-busy aria-label="Carregando a rodada">
      <Surface className="col-span-12 flex flex-col items-center gap-6 p-6 sm:flex-row lg:col-span-7">
        <div className="h-[118px] w-[220px] shrink-0 rounded-t-full bg-surface-2 motion-safe:animate-pulse" aria-hidden />
        <Skeleton lines={3} className="w-full flex-1" />
      </Surface>
      <Surface className="col-span-12 flex items-end justify-center gap-2.5 p-6 lg:col-span-5">
        {[96, 128, 72].map((h, i) => (
          <div key={i} className="w-[31%] max-w-[180px] rounded-t-md bg-surface-2 motion-safe:animate-pulse" style={{ height: h }} aria-hidden />
        ))}
      </Surface>
      <div className="col-span-12 flex flex-col gap-4 lg:col-span-8">
        <Skeleton className="w-48" />
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Surface key={i} className="flex flex-col gap-3 p-4">
              <Skeleton className="w-24" />
              <div className="flex items-center gap-3">
                <Skeleton shape="ring" />
                <Skeleton lines={2} className="flex-1" />
              </div>
            </Surface>
          ))}
        </div>
      </div>
      <div className="col-span-12 flex flex-col gap-4 lg:col-span-4">
        <Skeleton className="w-32" />
        <Surface className="flex flex-col gap-4 p-4">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton shape="ring" />
              <Skeleton lines={2} className="flex-1" />
            </div>
          ))}
        </Surface>
      </div>
    </div>
  );
}

/** A tarefa aberta do cliente; sem aberta, a mais recente. */
function taskFor(tasks: RodadaTaskInfo[], client: string): RodadaTaskInfo | undefined {
  const mine = tasks.filter((t) => t.client === client);
  return mine.find((t) => !t.closed) ?? mine[mine.length - 1];
}

/** Tile dos vermelhos (D2.5): lista em `Surface light` com anel, sequência, missão, prazo e a tarefa do ClickUp. */
function RedList({
  reds,
  data,
  now,
  busy,
  onCreate,
  className,
}: {
  reds: RodadaClient[];
  data: Snapshot;
  now: number | null;
  busy: string | null;
  onCreate: (r: RodadaClient) => void;
  className?: string;
}) {
  return (
    <section aria-label="Clientes no vermelho" className={cn("flex flex-col gap-4", className)}>
      <SectionTitle title="No vermelho" hint={`Plano de recuperação no ClickUp, ${plural(reds.length, "cliente", "clientes")}.`} />
      {!data.clickup && <Notice tone="info">O ClickUp ainda não está ligado no servidor, então as tarefas não são criadas.</Notice>}
      {reds.length ? (
        <Surface light className="px-2 py-1">
          <ul className="flex flex-col divide-y divide-line">
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
                onCreate={() => onCreate(r)}
              />
            ))}
          </ul>
        </Surface>
      ) : (
        <Empty title="Nenhum cliente no vermelho nesta rodada" text="Quando um cliente cair abaixo de 4, ele aparece aqui com a tarefa." />
      )}
    </section>
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
    <li className="flex flex-col gap-2.5 px-2 py-3">
      <div className="flex items-center gap-3">
        <Ring value={row.score} tone={row.tone} size={32} />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate type-subtitle text-fg">{row.name}</span>
          <span className="type-caption text-dim">
            {row.owner || "sem dono"} ·{" "}
            {decide ? (
              <b className="font-semibold text-bad">{row.redStreak} rodadas no vermelho: decidir na reunião</b>
            ) : row.redStreak > 1 ? (
              `${row.redStreak}ª rodada seguida`
            ) : (
              "primeira rodada no vermelho"
            )}
          </span>
        </div>
      </div>
      {mission && (
        <span className={cn("type-body", mission.blocked ? "text-warn" : "text-mute")}>
          Missão (+{mission.points}): {mission.todo.charAt(0).toLowerCase() + mission.todo.slice(1)}
        </span>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {task && <Deadline task={task} now={now} />}
        {task && (
          <Button size="sm" variant="soft" href={task.url} {...EXTERNAL_LINK} iconEnd={<ArrowUpRight aria-hidden strokeWidth={1.75} />}>
            {open ? `Tarefa: ${task.status || "aberta"}` : "Tarefa fechada"}
            {task.escalated ? " · escalada" : ""}
          </Button>
        )}
        {!open && canCreate && (
          <Button size="sm" variant="soft" onClick={onCreate} disabled={disabled} pending={busy}>
            {task ? "Criar nova tarefa" : "Criar tarefa"}
          </Button>
        )}
      </div>
    </li>
  );
}

/** Como pontua, num tile quieto (`Surface` nível 1 sem luz). */
function Rules() {
  const items = [
    [`+${POINTS.leitura}`, "cliente com leitura (tem meta e número)"],
    [`+${POINTS.verde}`, "cliente no verde"],
    [`+${POINTS.virada}`, "virada: saiu do vermelho para amarelo ou verde"],
    [`+${POINTS.sequencia}`, `a cada ${STREAK} rodadas seguidas no verde (selo de indicação)`],
  ];
  return (
    <section aria-label="Como pontua">
      <Surface className="flex h-full flex-col gap-3 p-5">
        <SectionTitle title="Como pontua" hint="Não existe ponto negativo." />
        <ul className="flex flex-col gap-1.5 type-body text-mute">
          {items.map(([p, t]) => (
            <li key={t}>
              <b className="mr-1.5 font-semibold tabular-nums text-fg">{p}</b> {t}
            </li>
          ))}
        </ul>
        <p className="max-w-[68ch] type-body text-mute">
          XP da rodada é a média de pontos por cliente × 10, para carteira grande não ganhar só pelo tamanho. O XP das rodadas fechadas soma na
          temporada e sobe o nível: {LEVELS.map((l) => `${l.name} (${l.from})`).join(", ")}. A rodada fecha na segunda às 10h e a nota fica
          congelada. Vermelho vira tarefa no ClickUp com prazo de 72h, e quem tira o cliente do vermelho é o número, não a tarefa fechada.
        </p>
      </Surface>
    </section>
  );
}
