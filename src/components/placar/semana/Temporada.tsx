"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Crown, Lock } from "lucide-react";
import { Bar, Button, Label, Modal, Pill, PlayerLevel, Score as Ring, Surface, spring } from "@/components/ui";
import { ACHIEVEMENTS, SEASON, TEAM_GOAL } from "@/lib/placar/rodada-rules";
import type { SeasonLine } from "@/lib/placar/jogo";
import type { OwnerLine, SemanaSnapshot } from "@/lib/placar/rodada";
import type { Tone } from "@/lib/placar/score";
import { addWeeks, fmt2, weekLabel } from "@/lib/placar/score";
import { cn } from "@/lib/utils";
import { ACH_ICON, closesAt, pct, plural } from "./comum";

const fmtDay = (ms: number) => new Date(ms).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

/** As 14 rodadas da temporada: fechada acende, a em andamento pulsa, a futura é só trilho. Tocar numa rodada abre as datas. */
export function SeasonTrack({ season, week, live }: { season: SemanaSnapshot["season"]; week: string; live: string }) {
  const closed = new Set(season.closedWeeks);
  const [open, setOpen] = useState<number | null>(null);
  const rounds = Array.from({ length: SEASON.rounds }, (_, i) => {
    const w = addWeeks(SEASON.start, i);
    return { i, w, isClosed: closed.has(w), isLive: w === live, isSeen: w === week };
  });
  const sel = open === null ? null : rounds[open];
  const status = (r: (typeof rounds)[number]) => (r.isClosed ? "fechada" : r.isLive ? "em andamento" : "ainda vai acontecer");

  return (
    <section aria-label="Temporada" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <Label>{season.name}</Label>
        <span className="type-caption text-mute">
          {season.round ? (
            <>
              Rodada <b className="font-semibold tabular-nums text-fg">{season.round}</b> de {season.rounds}
            </>
          ) : (
            "fora da temporada"
          )}
          {" · "}
          {plural(closed.size, "rodada fechada", "rodadas fechadas")}
        </span>
      </div>
      <ol className="grid grid-cols-[repeat(14,minmax(0,1fr))] gap-1" aria-label="Rodadas da temporada">
        {rounds.map((r) => (
          <li key={r.w} className="min-w-0">
            <button
              type="button"
              onClick={() => setOpen(r.i)}
              aria-label={`Rodada ${r.i + 1}, ${weekLabel(r.w)}, ${status(r)}${r.isSeen ? ", em tela" : ""}`}
              aria-current={r.isSeen ? "true" : undefined}
              className={cn(
                "flex h-11 w-full items-center rounded-full outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                r.isSeen && "[&>div]:outline [&>div]:outline-2 [&>div]:outline-offset-2 [&>div]:outline-fg/60",
              )}
            >
              <Bar value={r.isClosed || r.isLive ? 1 : 0} max={1} size="sm" className={cn(r.isLive && "motion-safe:animate-pulse")} />
            </button>
          </li>
        ))}
      </ol>

      <Modal open={sel !== null} onClose={() => setOpen(null)} size="sm" title={sel ? `Rodada ${sel.i + 1} de ${SEASON.rounds}` : "Rodada"}>
        {sel && (
          <dl className="flex flex-col gap-3">
            <div className="flex flex-col gap-0.5">
              <dt className="type-label text-dim">Semana</dt>
              <dd className="type-subtitle tabular-nums text-fg">{weekLabel(sel.w)}</dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="type-label text-dim">Fecha</dt>
              <dd className="type-body tabular-nums text-fg">segunda {fmtDay(closesAt(sel.w))} às 10h</dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="type-label text-dim">Situação</dt>
              <dd className="flex flex-wrap gap-1.5">
                <Pill tone={sel.isClosed ? "accent" : sel.isLive ? "good" : "neutral"}>{status(sel)}</Pill>
                {sel.isSeen && <Pill>em tela</Pill>}
              </dd>
            </div>
          </dl>
        )}
      </Modal>
    </section>
  );
}

/** Tom do anel da meta: verde a partir dos 70%, amarelo a partir dos 40%. */
const goalTone = (p: number): Tone => (p >= TEAM_GOAL * 100 ? "good" : p >= 40 ? "warn" : "bad");

/**
 * Gesto-herói da tela (§6.4): meta do time como anel em percentual e o pódio da rodada
 * no mesmo `Surface glow`. É o único brilho de acento da Rodada.
 */
export function TeamGoal({
  green,
  total,
  owners,
  levels,
  onPick,
}: {
  green: number;
  total: number;
  owners: OwnerLine[];
  levels: Map<string, SeasonLine>;
  onPick: (o: string) => void;
}) {
  const p = pct(green, total);
  const goal = Math.round(TEAM_GOAL * 100);
  const need = Math.max(0, Math.ceil(TEAM_GOAL * total) - green);
  return (
    <Surface glow className="grid gap-8 p-5 sm:p-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-center">
      <div className="flex items-center gap-5">
        <Ring value={total ? (green / total) * 10 : null} tone={goalTone(p)} size={56} label={`${green} de ${total} no verde, meta ${goal}%`} />
        <div className="flex min-w-0 flex-col gap-1">
          <span className="type-title text-fg">{need ? `faltam ${plural(need, "cliente", "clientes")} no verde` : "meta do time batida"}</span>
          <span className="type-caption text-mute">
            <span className="tabular-nums">{green} de {total}</span> no verde · <span className="tabular-nums">{p}%</span> hoje, meta {goal}% em janeiro
          </span>
        </div>
      </div>
      <div className="min-w-0">
        {owners.length ? <Podium owners={owners} levels={levels} onPick={onPick} /> : <p className="type-body text-mute">Nenhum cliente com dono nesta rodada.</p>}
      </div>
    </Surface>
  );
}

const MAX_H = 112;
const MIN_H = 40;

/** Pódio: 2º, 1º e 3º lado a lado, coluna com altura proporcional ao XP, 1º com fio dourado. Quem vem depois, em lista. */
export function Podium({
  owners,
  levels,
  onPick,
  delay = 0,
  stagger = 0.12,
}: {
  owners: OwnerLine[];
  levels?: Map<string, SeasonLine>;
  onPick?: (o: string) => void;
  /** Atraso antes da primeira coluna subir (a revelação espera o título). */
  delay?: number;
  stagger?: number;
}) {
  const reduce = useReducedMotion();
  const top = owners.slice(0, 3);
  const rest = owners.slice(3);
  const order = [top[1], top[0], top[2]].filter(Boolean) as OwnerLine[];
  const maxXp = Math.max(1, ...top.map((o) => o.xp));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end justify-center gap-2.5">
        {order.map((o) => {
          const pos = owners.indexOf(o);
          const lead = pos === 0 && o.points > 0;
          const h = Math.round(MIN_H + (o.xp / maxXp) * (MAX_H - MIN_H));
          const Tag = onPick ? "button" : "div";
          return (
            <Tag
              key={o.owner}
              {...(onPick ? { type: "button" as const, onClick: () => onPick(o.owner), "aria-label": `${pos + 1}º ${o.owner}, ${o.xp} XP. Ver as missões de ${o.owner}` } : {})}
              className={cn(
                "group flex w-[31%] max-w-[170px] flex-col items-center gap-2 rounded-md outline-none",
                onPick && "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
              )}
            >
              <span className="flex flex-col items-center gap-0.5">
                {lead && <Crown aria-hidden className="size-[18px] text-gold" strokeWidth={1.75} />}
                <span className={cn("max-w-full truncate type-subtitle text-fg", onPick && "group-hover:underline")}>{o.owner}</span>
                <span className="type-caption text-dim">{levels?.get(o.owner)?.level.name ?? "Estreante"}</span>
              </span>
              <motion.span
                className={cn("flex w-full flex-col items-center justify-start gap-1 rounded-t-md bg-surface-2 pt-3 shadow-relief", lead ? "border-t-2 border-gold" : "border-t border-line")}
                style={{ height: h, originY: 1 }}
                initial={reduce ? false : { scaleY: 0, opacity: 0 }}
                animate={{ scaleY: 1, opacity: 1 }}
                transition={{ ...spring, delay: reduce ? 0 : delay + stagger * (2 - pos) }}
              >
                <span className="type-metric-sm text-fg">{o.xp}</span>
                <Label>XP · {pos + 1}º</Label>
              </motion.span>
            </Tag>
          );
        })}
      </div>
      {rest.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {rest.map((o, i) => (
            <li key={o.owner} className="flex min-h-11 items-center justify-between gap-3 px-1">
              <span className="type-body text-mute">
                <span className="mr-1.5 tabular-nums text-dim">{i + 4}º</span>
                {onPick ? (
                  <Button variant="link" onClick={() => onPick(o.owner)}>
                    {o.owner}
                  </Button>
                ) : (
                  o.owner
                )}
              </span>
              <span className="type-body tabular-nums text-fg">{o.xp} XP</span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-center type-caption text-dim">
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

/** Tabela da temporada: XP acumulado, nível e selos. Clicar filtra a pessoa. */
export function SeasonTable({ table, picked, onPick }: { table: SeasonLine[]; picked: string; onPick: (o: string) => void }) {
  return (
    <ol className="flex flex-col gap-2">
      {table.map((l, i) => {
        const active = picked === l.owner;
        return (
          <li key={l.owner}>
            <Surface
              as="button"
              interactive
              level={active ? 2 : 1}
              type="button"
              onClick={() => onPick(active ? "todos" : l.owner)}
              aria-pressed={active}
              className={cn("grid w-full min-h-11 grid-cols-[28px_minmax(0,1fr)] gap-x-3 gap-y-2 px-4 py-3 text-left sm:grid-cols-[28px_minmax(0,1fr)_auto] sm:items-center", active && "border-line-strong")}
            >
              <span className="type-caption tabular-nums text-dim">{i + 1}º</span>
              <span className="flex min-w-0 flex-col gap-1.5">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="truncate type-subtitle text-fg">{l.owner}</span>
                  <span className="shrink-0 type-metric-sm text-fg">
                    {l.xp} <span className="type-caption font-medium text-dim">XP</span>
                  </span>
                </span>
                <PlayerLevel xp={l.xp} level={l.level} size="md" />
                <span className="type-caption text-dim">{plural(l.rounds, "rodada fechada", "rodadas fechadas")}</span>
              </span>
              <span className="col-start-2 flex gap-1.5 sm:col-start-3" aria-label={`${l.achievements.length} de ${ACHIEVEMENTS.length} conquistas`}>
                {ACHIEVEMENTS.map((a) => {
                  const Icon = ACH_ICON[a.id];
                  const on = l.achievements.includes(a.id);
                  return <Icon key={a.id} aria-hidden className={cn("size-[18px]", on ? "text-fg" : "text-mute opacity-50")} strokeWidth={1.75} />;
                })}
              </span>
            </Surface>
          </li>
        );
      })}
    </ol>
  );
}

/** Mural das conquistas da temporada: quem já destravou cada uma. */
export function Conquistas({ table }: { table: SeasonLine[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {ACHIEVEMENTS.map((a) => {
        const Icon = ACH_ICON[a.id];
        const who = table.filter((l) => l.achievements.includes(a.id)).map((l) => l.owner);
        const progress = a.id === "hat-trick" ? table.filter((l) => l.progress["hat-trick"] && l.viradas > 0) : [];
        const on = who.length > 0;
        return (
          <Surface as="li" key={a.id} className="flex gap-3 px-4 py-3">
            <span className={cn("mt-0.5 shrink-0", on ? "text-fg" : "text-dim")}>
              {on ? <Icon aria-hidden className="size-5" strokeWidth={1.75} /> : <Lock aria-hidden className="size-5" strokeWidth={1.75} />}
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className={cn("type-subtitle", on ? "text-fg" : "text-mute")}>{a.name}</span>
              <span className="type-caption text-dim">{a.how}</span>
              <span className="mt-1 type-caption text-mute">
                {on ? who.join(", ") : progress.length ? progress.map((l) => `${l.owner} ${l.progress["hat-trick"]}`).join(", ") : "ninguém ainda"}
              </span>
            </span>
          </Surface>
        );
      })}
    </ul>
  );
}
