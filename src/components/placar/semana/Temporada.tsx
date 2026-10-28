"use client";

import { motion, useReducedMotion } from "motion/react";
import { Crown, Lock } from "lucide-react";
import { ACHIEVEMENTS, LEVELS, SEASON, TEAM_GOAL } from "@/lib/placar/rodada-rules";
import type { SeasonLine } from "@/lib/placar/jogo";
import type { OwnerLine, SemanaSnapshot } from "@/lib/placar/rodada";
import { addWeeks, fmt2, weekLabel } from "@/lib/placar/score";
import { ACH_ICON, CountUp, SectionTitle, pct, plural } from "./comum";

/** As 14 rodadas da temporada: fechada acende, a vista ganha contorno, a em andamento pulsa. */
export function SeasonTrack({ season, week, live }: { season: SemanaSnapshot["season"]; week: string; live: string }) {
  const closed = new Set(season.closedWeeks);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-500">{season.name}</span>
        <span className="text-[12.5px] text-zinc-400">
          {season.round ? (
            <>
              Rodada <b className="font-mono font-semibold text-white">{season.round}</b> de {season.rounds}
            </>
          ) : (
            "fora da temporada"
          )}
          {" · "}
          {plural(closed.size, "rodada fechada", "rodadas fechadas")}
        </span>
      </div>
      <ol className="grid grid-cols-[repeat(14,minmax(0,1fr))] gap-1" aria-label="Rodadas da temporada">
        {Array.from({ length: SEASON.rounds }, (_, i) => {
          const w = addWeeks(SEASON.start, i);
          const isClosed = closed.has(w);
          const isLive = w === live;
          const isSeen = w === week;
          return (
            <li
              key={w}
              title={`Rodada ${i + 1} · ${weekLabel(w)}${isClosed ? " · fechada" : isLive ? " · em andamento" : ""}`}
              className={`h-2 rounded-full ${isClosed ? "bg-[#00e5ff]" : isLive ? "animate-pulse bg-[#00e5ff]/45" : "bg-white/[0.07]"} ${isSeen ? "outline outline-2 outline-offset-2 outline-white/60" : ""}`}
            />
          );
        })}
      </ol>
    </div>
  );
}

/** Meta do time como barra de chefe: quantos verdes faltam para os 70%. */
export function TeamGoal({ green, total }: { green: number; total: number }) {
  const reduce = useReducedMotion();
  const p = pct(green, total);
  const goal = Math.round(TEAM_GOAL * 100);
  const need = Math.max(0, Math.ceil(TEAM_GOAL * total) - green);
  return (
    <section aria-label="Meta do time" className="flex flex-col gap-3 rounded-2xl border border-white/8 bg-white/[0.015] px-5 py-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-[12.5px] font-medium text-zinc-400">Meta do time · {goal}% da carteira no verde em janeiro</span>
          <span className="font-mono text-[30px] font-semibold leading-none tracking-[-0.02em] tabular-nums text-white">
            <CountUp value={green} /> <span className="text-[18px] text-zinc-500">de {total} no verde</span>
          </span>
        </div>
        <span className={`rounded-full px-3 py-1 text-[13px] font-medium ${need ? "bg-white/[0.04] text-zinc-300" : "bg-emerald-400/15 text-emerald-300"}`}>
          {need ? (
            <>
              faltam <b className="font-mono text-white">{need}</b> {need === 1 ? "cliente" : "clientes"} no verde
            </>
          ) : (
            "meta do time batida"
          )}
        </span>
      </div>
      <div
        role="img"
        aria-label={`${p}% da carteira no verde, meta de ${goal}%`}
        className="relative h-3.5 overflow-hidden rounded-full bg-white/[0.05]"
      >
        <motion.span
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300"
          initial={reduce ? false : { width: 0 }}
          animate={{ width: `${p}%` }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
        />
        <span aria-hidden className="absolute inset-y-0 w-0.5 bg-[#00e5ff]" style={{ left: `${goal}%` }} />
      </div>
      <div className="flex justify-between font-mono text-[11px] text-zinc-600">
        <span>{p}% hoje</span>
        <span className="text-[#00e5ff]/80">meta {goal}%</span>
      </div>
    </section>
  );
}

const PODIUM_H = ["h-28", "h-20", "h-14"];

/** Pódio da rodada: 2º, 1º e 3º lado a lado; quem vem depois, em lista. */
export function Podium({ owners, levels, onPick }: { owners: OwnerLine[]; levels: Map<string, SeasonLine>; onPick: (o: string) => void }) {
  const reduce = useReducedMotion();
  const top = owners.slice(0, 3);
  const rest = owners.slice(3);
  const order = [top[1], top[0], top[2]].filter(Boolean) as OwnerLine[];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end justify-center gap-2.5">
        {order.map((o) => {
          const pos = owners.indexOf(o);
          const lead = pos === 0 && o.points > 0;
          return (
            <button
              key={o.owner}
              type="button"
              onClick={() => onPick(o.owner)}
              className="group flex w-[31%] max-w-[170px] flex-col items-center gap-2 focus-visible:outline-none"
              aria-label={`${pos + 1}º ${o.owner}, ${o.xp} XP. Ver as missões de ${o.owner}`}
            >
              <span className="flex flex-col items-center gap-0.5">
                {lead && <Crown aria-hidden className="size-5 text-[#00e5ff]" />}
                <span className="text-[15px] font-semibold text-white group-hover:underline group-focus-visible:underline">{o.owner}</span>
                <span className="text-[11.5px] text-zinc-500">{levels.get(o.owner)?.level.name ?? "Estreante"}</span>
              </span>
              <motion.span
                className={`flex w-full flex-col items-center justify-start rounded-t-xl border border-b-0 pt-2.5 ${PODIUM_H[pos]} ${lead ? "border-[#00e5ff]/50 bg-[#00e5ff]/[0.09]" : "border-white/10 bg-white/[0.03]"}`}
                initial={reduce ? false : { scaleY: 0, opacity: 0 }}
                animate={{ scaleY: 1, opacity: 1 }}
                style={{ originY: 1 }}
                transition={{ duration: 0.6, delay: reduce ? 0 : 0.15 * (2 - pos), ease: [0.22, 1, 0.36, 1] }}
              >
                <span className="font-mono text-[24px] font-semibold leading-none tabular-nums text-white">
                  <CountUp value={o.xp} delay={150 * (2 - pos)} />
                </span>
                <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-zinc-500">XP · {pos + 1}º</span>
              </motion.span>
            </button>
          );
        })}
      </div>
      {rest.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {rest.map((o, i) => (
            <li key={o.owner}>
              <button
                type="button"
                onClick={() => onPick(o.owner)}
                className="flex w-full items-center justify-between rounded-lg border border-white/8 bg-white/[0.015] px-3 py-2 text-left text-[13px] text-zinc-300 hover:border-white/20"
              >
                <span>
                  <span className="mr-1.5 font-mono text-zinc-500">{i + 4}º</span>
                  {o.owner}
                </span>
                <span className="font-mono tabular-nums text-white">{o.xp} XP</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-center text-[12px] text-zinc-500">
        XP da rodada = média de pontos por cliente × 10.{" "}
        {owners[0] && owners[0].points > 0 && (
          <>
            {owners[0].owner} fez {fmt2(owners[0].avg)} {owners[0].avg === 1 ? "pt" : "pts"} por cliente.
          </>
        )}
      </p>
    </div>
  );
}

/** Tabela da temporada: XP acumulado, nível e conquistas. Clicar filtra a pessoa. */
export function SeasonTable({ table, picked, onPick }: { table: SeasonLine[]; picked: string; onPick: (o: string) => void }) {
  const reduce = useReducedMotion();
  return (
    <ol className="flex flex-col gap-2">
      {table.map((l, i) => {
        const span = l.level.next === null ? 1 : (l.xp - l.level.from) / (l.level.next - l.level.from);
        const active = picked === l.owner;
        return (
          <li key={l.owner}>
            <button
              type="button"
              onClick={() => onPick(active ? "todos" : l.owner)}
              aria-pressed={active}
              className={`flex w-full flex-col gap-2 rounded-xl border px-4 py-3 text-left transition-colors ${active ? "border-[#00e5ff]/50 bg-[#00e5ff]/[0.05]" : "border-white/8 bg-white/[0.015] hover:border-white/20"}`}
            >
              <span className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="w-5 font-mono text-[13px] text-zinc-500">{i + 1}º</span>
                  <span className="truncate text-[14.5px] font-semibold text-white">{l.owner}</span>
                  <span className="rounded-full border border-white/10 px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.08em] text-zinc-400">
                    nv {l.level.n} · {l.level.name}
                  </span>
                </span>
                <span className="font-mono text-[18px] font-semibold tabular-nums text-white">
                  <CountUp value={l.xp} />
                  <span className="ml-1 text-[11px] font-normal text-zinc-500">XP</span>
                </span>
              </span>
              <span className="relative h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                <motion.span
                  className="absolute inset-y-0 left-0 rounded-full bg-[#00e5ff]"
                  initial={reduce ? false : { width: 0 }}
                  animate={{ width: `${Math.round(Math.max(0, Math.min(1, span)) * 100)}%` }}
                  transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                />
              </span>
              <span className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11.5px] text-zinc-500">
                  {l.level.next === null ? "nível máximo" : `${l.level.next - l.xp} XP para ${LEVELS[l.level.n]?.name}`}
                  {" · "}
                  {plural(l.rounds, "rodada", "rodadas")}
                </span>
                <span className="flex gap-1" aria-label={`${l.achievements.length} de ${ACHIEVEMENTS.length} conquistas`}>
                  {ACHIEVEMENTS.map((a) => {
                    const Icon = ACH_ICON[a.id];
                    const on = l.achievements.includes(a.id);
                    return (
                      <Icon
                        key={a.id}
                        aria-hidden
                        className={`size-3.5 ${on ? "text-[#00e5ff]" : "text-zinc-700"}`}
                        strokeWidth={2.2}
                      />
                    );
                  })}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/** Mural das conquistas da temporada: quem já destravou cada uma. */
export function Conquistas({ table }: { table: SeasonLine[] }) {
  return (
    <section aria-label="Conquistas da temporada" className="flex flex-col gap-3">
      <SectionTitle right="não dão ponto, marcam o caminho">Conquistas da temporada</SectionTitle>
      <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        {ACHIEVEMENTS.map((a) => {
          const Icon = ACH_ICON[a.id];
          const who = table.filter((l) => l.achievements.includes(a.id)).map((l) => l.owner);
          const progress = a.id === "hat-trick" ? table.filter((l) => l.progress["hat-trick"] && l.viradas > 0) : [];
          const on = who.length > 0;
          return (
            <li
              key={a.id}
              className={`flex gap-3 rounded-xl border px-4 py-3 ${on ? "border-[#00e5ff]/35 bg-[#00e5ff]/[0.04]" : "border-white/8 bg-white/[0.01]"}`}
            >
              <span
                className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${on ? "bg-[#00e5ff] text-[#04141a]" : "bg-white/[0.04] text-zinc-600"}`}
              >
                {on ? <Icon aria-hidden className="size-[18px]" strokeWidth={2.2} /> : <Lock aria-hidden className="size-4" />}
              </span>
              <span className="flex min-w-0 flex-col">
                <span className={`text-[13.5px] font-semibold ${on ? "text-white" : "text-zinc-400"}`}>{a.name}</span>
                <span className="text-[12px] leading-snug text-zinc-500">{a.how}</span>
                <span className="mt-1 text-[12px] text-zinc-300">
                  {on
                    ? who.join(", ")
                    : progress.length
                      ? progress.map((l) => `${l.owner} ${l.progress["hat-trick"]}`).join(", ")
                      : "ninguém ainda"}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
