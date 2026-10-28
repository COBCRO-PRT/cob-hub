"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CircleCheck, ExternalLink, Flame, X } from "lucide-react";
import { STREAK } from "@/lib/placar/rodada-rules";
import type { LaunchLine, Mission } from "@/lib/placar/jogo";
import type { RodadaClient, RodadaTaskInfo } from "@/lib/placar/rodada";
import { TONE_RANK, addWeeks, fmtScore, weekLabel } from "@/lib/placar/score";
import { TONE_STYLE, btnGhost } from "../tones";
import { Empty, KIND, ScoreBadge, SectionTitle, TrailDots, closesAt, countdown, pct, useNow } from "./comum";

export const SEM_DONO = "sem-dono";

/** Quem aparece: "todos", um dono ou quem está sem dono. */
export const matches = (picked: string, owner: string) =>
  picked === "todos" || (picked === SEM_DONO ? !owner : owner === picked);

export function PersonFilter({ owners, picked, onPick }: { owners: string[]; picked: string; onPick: (o: string) => void }) {
  const opts = [
    { id: "todos", label: "Todos" },
    ...owners.map((o) => ({ id: o, label: o })),
    { id: SEM_DONO, label: "Sem dono" },
  ];
  return (
    <div role="group" aria-label="Ver por pessoa" className="flex flex-wrap gap-1.5">
      {opts.map((o) => {
        const on = picked === o.id;
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={on}
            onClick={() => onPick(o.id)}
            className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${on ? "bg-[#00e5ff] text-[#04141a]" : "border border-white/10 text-zinc-300 hover:border-white/25 hover:text-white"}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

const FIRST = 9;

/** Missões da semana em andamento, com o número que falta e quanto valem. */
export function Missions({
  missions,
  launch,
  week,
  picked,
}: {
  missions: Mission[];
  launch: LaunchLine[];
  week: string;
  picked: string;
}) {
  const reduce = useReducedMotion();
  const now = useNow();
  const [all, setAll] = useState(false);
  const list = missions.filter((m) => matches(picked, m.owner));
  const open = list.filter((m) => !m.done);
  const done = list.filter((m) => m.done);
  const prize = open.reduce((n, m) => n + m.points, 0);
  const shown = all ? list : list.slice(0, FIRST);
  const bars = launch.filter((l) => matches(picked, l.owner) && picked !== "sem-dono");

  return (
    <section aria-label="Missões da semana" className="flex flex-col gap-3">
      <SectionTitle right={now ? `fecha em ${countdown(closesAt(week) - now)} · segunda às 10h` : undefined}>
        Missões da semana · {weekLabel(week)}
      </SectionTitle>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl border border-white/8 bg-white/[0.015] px-5 py-4">
        <div className="flex flex-col">
          <span className="font-mono text-[28px] font-semibold leading-none tabular-nums text-white">
            +{prize}
            <span className="ml-1.5 text-[12px] font-normal text-zinc-500">pts em jogo</span>
          </span>
          <span className="mt-1 text-[12.5px] text-zinc-400">
            {open.length} {open.length === 1 ? "missão aberta" : "missões abertas"} · {done.length}{" "}
            {done.length === 1 ? "cumprida" : "cumpridas"}
          </span>
        </div>
        {bars.length > 0 && (
          <div className="flex min-w-[220px] flex-1 flex-col gap-2">
            <span className="text-[11.5px] font-medium uppercase tracking-[0.12em] text-zinc-500">Números da semana lançados</span>
            {bars.map((l) => (
              <div key={l.owner} className="flex items-center gap-3 text-[12.5px]">
                <span className="w-16 shrink-0 truncate text-zinc-300">{l.owner}</span>
                <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                  <motion.span
                    className={`absolute inset-y-0 left-0 rounded-full ${l.done === l.total ? "bg-emerald-400" : "bg-[#00e5ff]"}`}
                    initial={reduce ? false : { width: 0 }}
                    animate={{ width: `${pct(l.done, l.total)}%` }}
                    transition={{ duration: 0.8 }}
                  />
                </span>
                <span className="w-12 shrink-0 text-right font-mono tabular-nums text-zinc-400">
                  {l.done}/{l.total}
                </span>
              </div>
            ))}
          </div>
        )}
        <Link href="/placar" className={`${btnGhost} h-9`}>
          Lançar no placar
        </Link>
      </div>

      {list.length ? (
        <>
          <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence initial={false}>
              {shown.map((m) => (
                <MissionCard key={`${m.client}_${m.kind}`} m={m} />
              ))}
            </AnimatePresence>
          </ul>
          {list.length > FIRST && (
            <button type="button" onClick={() => setAll(!all)} className={`${btnGhost} h-9 self-center`}>
              {all ? "Mostrar menos" : `Ver todas as ${list.length} missões`}
            </button>
          )}
        </>
      ) : (
        <Empty>Nenhuma missão para esta pessoa nesta semana.</Empty>
      )}
    </section>
  );
}

function MissionCard({ m }: { m: Mission }) {
  const reduce = useReducedMotion();
  const k = KIND[m.kind];
  const Icon = k.icon;
  return (
    <motion.li
      layout={!reduce}
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className={`flex flex-col gap-2 rounded-xl border px-4 py-3 ${m.done ? "border-emerald-400/30 bg-emerald-400/[0.05]" : k.ring}`}
    >
      <span className="flex items-center justify-between gap-2">
        <span className={`inline-flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-[0.1em] ${m.done ? "text-emerald-300" : k.text}`}>
          {m.done ? <CircleCheck aria-hidden className="size-3.5" /> : <Icon aria-hidden className="size-3.5" />}
          {m.done ? "Cumprida" : k.label}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 font-mono text-[12px] font-semibold tabular-nums ${m.done ? "bg-emerald-400 text-[#04141a]" : "bg-white/[0.06] text-white"}`}
        >
          +{m.points}
        </span>
      </span>
      <span className="flex items-center gap-2">
        <ScoreBadge tone={m.tone} score={m.score} size="sm" />
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-[14px] font-medium text-white">{m.name}</span>
          <span className="text-[12px] text-zinc-500">{m.owner || "sem dono"}</span>
        </span>
      </span>
      <span className={`text-[13px] leading-snug ${m.blocked ? "text-amber-300" : m.done ? "text-emerald-200/80" : "text-zinc-300"}`}>
        {m.todo}
      </span>
    </motion.li>
  );
}

/** Mapa da carteira: um quadrado por cliente na cor da nota. Clicar abre a ficha. */
export function ClientMap({
  rows,
  picked,
  missions,
  tasks,
}: {
  rows: RodadaClient[];
  picked: string;
  missions: Mission[];
  tasks: RodadaTaskInfo[];
}) {
  const [open, setOpen] = useState<string | null>(null);
  const list = useMemo(
    () =>
      rows
        .filter((r) => matches(picked, r.owner))
        .sort((a, b) => TONE_RANK[a.tone] - TONE_RANK[b.tone] || a.name.localeCompare(b.name, "pt-BR")),
    [rows, picked],
  );
  const count = (t: RodadaClient["tone"]) => list.filter((r) => r.tone === t).length;
  const sel = rows.find((r) => r.client === open) ?? null;

  return (
    <section aria-label="Mapa da carteira" className="flex flex-col gap-3">
      <SectionTitle
        right={
          <>
            <b className="text-red-400">{count("bad")}</b> vermelho · <b className="text-zinc-400">{count("none")}</b> cinza ·{" "}
            <b className="text-amber-300">{count("warn")}</b> amarelo · <b className="text-emerald-400">{count("good")}</b> verde
          </>
        }
      >
        Mapa da carteira · clique num cliente
      </SectionTitle>
      {list.length ? (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-2">
          {list.map((r) => {
            const t = TONE_STYLE[r.tone];
            return (
              <li key={r.client}>
                <button
                  type="button"
                  onClick={() => setOpen(r.client)}
                  className={`flex h-full w-full flex-col gap-1.5 rounded-xl border border-white/8 px-3 py-2.5 text-left transition hover:-translate-y-0.5 hover:border-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff] ${t.soft}`}
                >
                  <span className="flex items-center justify-between gap-1">
                    <span className={`font-mono text-[15px] font-semibold tabular-nums ${t.text}`}>
                      {r.score === null ? "s/n" : fmtScore(r.score)}
                    </span>
                    {r.greenStreak >= 2 && (
                      <span className="inline-flex items-center gap-0.5 font-mono text-[11px] text-[#7ff2ff]" title={`${r.greenStreak} rodadas seguidas no verde`}>
                        <Flame aria-hidden className="size-3" />
                        {r.greenStreak}
                      </span>
                    )}
                    {r.redStreak >= 2 && (
                      <span className="font-mono text-[11px] text-red-300" title={`${r.redStreak} rodadas seguidas no vermelho`}>
                        {r.redStreak}× vermelho
                      </span>
                    )}
                  </span>
                  <span className="line-clamp-2 text-[12.5px] font-medium leading-tight text-white">{r.name}</span>
                  <span className="text-[11px] text-zinc-500">{r.owner || "sem dono"}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <Empty>Nenhum cliente para esta pessoa nesta rodada.</Empty>
      )}
      <AnimatePresence>
        {sel && (
          <ClientSheet
            row={sel}
            mission={missions.find((m) => m.client === sel.client) ?? null}
            task={[...tasks].reverse().find((t) => t.client === sel.client && !t.closed) ?? null}
            onClose={() => setOpen(null)}
          />
        )}
      </AnimatePresence>
    </section>
  );
}

function ClientSheet({
  row,
  mission,
  task,
  onClose,
}: {
  row: RodadaClient;
  mission: Mission | null;
  task: RodadaTaskInfo | null;
  onClose: () => void;
}) {
  const reduce = useReducedMotion();
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const weeks = row.trail.map((_, i) => weekLabel(addWeeks(row.week, i - row.trail.length + 1)));
  const t = TONE_STYLE[row.tone];

  return (
    <motion.div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={`Ficha de ${row.name}`}
        className="flex w-full max-w-[440px] flex-col gap-4 rounded-2xl border border-white/10 bg-[#0c0e11] p-5 shadow-2xl"
        initial={reduce ? false : { y: 24, scale: 0.98 }}
        animate={{ y: 0, scale: 1 }}
        exit={reduce ? undefined : { y: 16, opacity: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col">
            <span className="text-[17px] font-semibold text-white">{row.name}</span>
            <span className="text-[12.5px] text-zinc-500">
              {row.owner || "sem dono"}
              {row.meta ? ` · meta ${row.meta}` : " · sem meta"}
            </span>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Fechar" className={`${btnGhost} size-8 px-0`}>
            <X aria-hidden className="size-4" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Stat label="Nota" value={row.score === null ? "s/n" : fmtScore(row.score)} className={t.text} />
          <Stat label="Pontos" value={`+${row.points}`} />
          <Stat
            label={row.tone === "bad" ? "No vermelho" : "No verde"}
            value={row.tone === "bad" ? `${row.redStreak}×` : `${row.greenStreak}×`}
            className={row.tone === "bad" ? "text-red-300" : "text-emerald-300"}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[11.5px] font-medium uppercase tracking-[0.12em] text-zinc-500">Últimas {row.trail.length} rodadas</span>
          <TrailDots trail={row.trail} weeks={weeks} />
          {row.greenStreak > 0 && row.greenStreak < STREAK && (
            <span className="text-[12px] text-zinc-400">
              Faltam {STREAK - row.greenStreak} rodadas no verde para o selo de indicação.
            </span>
          )}
          {row.badges.length > 0 && (
            <span className="text-[12px] text-[#7ff2ff]">
              Nesta rodada: {row.badges.map((b) => (b === "virada" ? "virada" : "selo de sequência")).join(" e ")}
            </span>
          )}
        </div>

        {mission && (
          <div className={`flex flex-col gap-1 rounded-xl border px-3.5 py-2.5 ${mission.done ? "border-emerald-400/30 bg-emerald-400/[0.05]" : KIND[mission.kind].ring}`}>
            <span className="text-[11.5px] font-semibold uppercase tracking-[0.1em] text-zinc-400">
              Missão desta semana · {mission.done ? "cumprida" : KIND[mission.kind].label} · +{mission.points}
            </span>
            <span className={`text-[13px] ${mission.blocked ? "text-amber-300" : "text-zinc-200"}`}>{mission.todo}</span>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Link href="/placar" className={`${btnGhost} h-9`}>
            Lançar no placar
          </Link>
          {task && (
            <a href={task.url} target="_blank" rel="noreferrer" className={`${btnGhost} h-9 gap-1.5`}>
              Tarefa no ClickUp <ExternalLink aria-hidden className="size-3.5" />
            </a>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function Stat({ label, value, className = "text-white" }: { label: string; value: string; className?: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2">
      <span className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-zinc-500">{label}</span>
      <span className={`font-mono text-[18px] font-semibold tabular-nums ${className}`}>{value}</span>
    </div>
  );
}
