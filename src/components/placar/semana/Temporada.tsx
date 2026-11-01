"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Crown, Lock } from "lucide-react";
import { Columns, Empty, Gauge, Label, Modal, Pill, PlayerLevel, SectionTitle, Surface, spring, type ColumnSeries } from "@/components/ui";
import { ACHIEVEMENTS, SEASON, TEAM_GOAL } from "@/lib/placar/rodada-rules";
import type { SeasonLine } from "@/lib/placar/jogo";
import type { OwnerLine, RodadaClient, SemanaSnapshot } from "@/lib/placar/rodada";
import { addWeeks, fmt2, weekLabel } from "@/lib/placar/score";
import { cn } from "@/lib/utils";
import { ACH_ICON, closesAt, pct, plural, shortWeek } from "./comum";

const fmtDay = (ms: number) => new Date(ms).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

/**
 * As 14 rodadas da temporada (D2.5): fechada em `fg`, a em andamento com o halo atrás, a futura só trilho.
 * Nenhum ciano sólido: o acento aparece só como luz. Tocar numa rodada abre as datas.
 */
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
              className="relative flex h-11 w-full items-center rounded-full outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {r.isLive && <span aria-hidden className="pointer-events-none absolute inset-x-[-40%] -top-2 bottom-0 bg-glow-accent" />}
              <span
                aria-hidden
                className={cn(
                  "relative h-1.5 w-full rounded-full",
                  r.isClosed ? "bg-fg" : r.isLive ? "bg-fg/60 motion-safe:animate-pulse" : "bg-line",
                  r.isSeen && "outline outline-2 outline-offset-[3px] outline-fg/60",
                )}
              />
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
                <Pill tone={sel.isClosed ? "good" : sel.isLive ? "warn" : "neutral"}>{status(sel)}</Pill>
                {sel.isSeen && <Pill>em tela</Pill>}
              </dd>
            </div>
          </dl>
        )}
      </Modal>
    </section>
  );
}

/**
 * Gesto-herói da Rodada (D2.5): o medidor da meta do time com o traço em 70%, "faltam N" ao lado
 * e, embaixo, os verdes das últimas 8 rodadas em colunas, com a semana em tela destacada.
 * É o único halo de acento da tela.
 */
export function TeamHero({
  green,
  total,
  rows,
  week,
  closed,
  className,
}: {
  green: number;
  total: number;
  rows: RodadaClient[];
  week: string;
  closed: boolean;
  className?: string;
}) {
  const p = pct(green, total);
  const goal = Math.round(TEAM_GOAL * 100);
  const need = Math.max(0, Math.ceil(TEAM_GOAL * total) - green);
  const viradas = rows.filter((r) => r.badges.includes("virada")).length;
  const prontos = rows.filter((r) => r.badges.includes("sequencia")).length;

  // Verdes por semana nas últimas 8 rodadas: a trilha de cada cliente vai da mais antiga até esta.
  const n = rows[0]?.trail.length ?? 0;
  const series: ColumnSeries[] = Array.from({ length: n }, (_, i) => {
    const w = addWeeks(week, i - n + 1);
    return { key: w, label: shortWeek(w), values: { good: rows.filter((r) => r.trail[i] === "good").length } };
  });

  const gaugeLabel = `${green} de ${total} no verde, ${p}%, meta ${goal}%`;
  const inside = (
    <>
      <span className="type-metric-lg text-fg">{p}%</span>
      <span className="type-caption text-mute">no verde</span>
    </>
  );

  return (
    <Surface glow light className={cn("flex flex-col gap-6 p-5 sm:p-6", className)}>
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-8">
        <Gauge value={p} marker={goal} size={220} label={gaugeLabel} className="max-sm:hidden">
          {inside}
        </Gauge>
        <Gauge value={p} marker={goal} size={180} label={gaugeLabel} className="sm:hidden">
          {inside}
        </Gauge>
        <div className="flex min-w-0 flex-col gap-1.5 text-center sm:text-left">
          <Label>Meta do time</Label>
          <span className="type-title text-fg">{need ? `faltam ${plural(need, "cliente", "clientes")} no verde` : "meta do time batida"}</span>
          <span className="type-caption text-mute">
            <span className="tabular-nums">
              {green} de {total}
            </span>{" "}
            no verde hoje, meta {goal}% em janeiro
          </span>
          {(viradas > 0 || prontos > 0) && (
            <span className="flex flex-wrap justify-center gap-1.5 pt-1 sm:justify-start">
              {viradas > 0 && <Pill tone="good">{plural(viradas, "virada", "viradas")}</Pill>}
              {prontos > 0 && <Pill>{plural(prontos, "pronto para indicação", "prontos para indicação")}</Pill>}
            </span>
          )}
        </div>
      </div>

      {series.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <Label>No verde, últimas {n} rodadas</Label>
            <span className="type-caption text-dim">{closed ? "até a rodada fechada" : "esta semana ainda muda"}</span>
          </div>
          <Columns
            series={series}
            highlight={week}
            height={72}
            compact
            label={`Clientes no verde por semana: ${series.map((s) => `${s.label} ${s.values.good ?? 0}`).join(", ")}`}
          />
        </div>
      )}
    </Surface>
  );
}

/** Tile do pódio (D2.5): três colunas de altura proporcional ao XP, 1º com fio dourado, 4º em linha abaixo. */
export function PodiumCard({
  owners,
  levels,
  onPick,
  closed,
  className,
}: {
  owners: OwnerLine[];
  levels: Map<string, SeasonLine>;
  onPick: (o: string) => void;
  closed: boolean;
  className?: string;
}) {
  return (
    <Surface light className={cn("flex flex-col gap-5 p-5 sm:p-6", className)}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="flex flex-col gap-0.5">
          <Label>Pódio da rodada</Label>
          <span className="type-caption text-mute">Toque numa pessoa para ver as missões dela.</span>
        </div>
        <Pill>{closed ? "rodada fechada" : "prévia, ainda muda"}</Pill>
      </div>
      {owners.length ? (
        <Podium owners={owners} levels={levels} onPick={onPick} />
      ) : (
        <Empty title="Nenhum cliente com dono nesta rodada" text="Dê um dono aos clientes no placar para o pódio aparecer." />
      )}
    </Surface>
  );
}

const MAX_H = 128;
const MIN_H = 64;

/** Pódio: 2º, 1º e 3º lado a lado, coluna com altura proporcional ao XP, 1º com fio dourado. Quem vem depois, em linha. */
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
    <div className="flex flex-col gap-4">
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
                "group flex w-[31%] max-w-[180px] flex-col items-center gap-2 rounded-md outline-none",
                onPick && "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
              )}
            >
              <span className="flex max-w-full flex-col items-center gap-0.5">
                {lead && <Crown aria-hidden className="size-4 text-gold" strokeWidth={1.75} />}
                <span className={cn("max-w-full truncate type-subtitle text-fg", onPick && "group-hover:underline")}>{o.owner}</span>
                <span className="type-caption text-dim">{levels?.get(o.owner)?.level.name ?? "Estreante"}</span>
              </span>
              <motion.span
                className={cn(
                  "flex w-full flex-col items-center justify-start gap-1 rounded-t-md bg-surface-2 pt-3",
                  lead ? "border-t-2 border-gold" : "border-t border-line-strong",
                )}
                style={{ height: h, originY: 1 }}
                initial={reduce ? false : { scaleY: 0, opacity: 0 }}
                animate={{ scaleY: 1, opacity: 1 }}
                transition={{ ...spring, delay: reduce ? 0 : delay + stagger * (2 - pos) }}
              >
                <span className="type-metric text-fg">{o.xp}</span>
                <Label>XP · {pos + 1}º</Label>
              </motion.span>
            </Tag>
          );
        })}
      </div>
      {rest.length > 0 && (
        <ul className="flex flex-col divide-y divide-line">
          {rest.map((o, i) => (
            <li key={o.owner} className="flex min-h-10 items-center justify-between gap-3 px-1">
              <span className="flex items-center gap-2 type-body text-mute">
                <span className="tabular-nums text-dim">{i + 4}º</span>
                {onPick ? (
                  <button type="button" onClick={() => onPick(o.owner)} className="rounded-sm font-medium text-fg underline-offset-4 outline-none hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                    {o.owner}
                  </button>
                ) : (
                  <span className="font-medium text-fg">{o.owner}</span>
                )}
              </span>
              <span className="type-metric-sm text-fg">
                {o.xp} <span className="type-caption font-medium text-dim">XP</span>
              </span>
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

/** Tabela da temporada (D2.5): 4 linhas com posição, nome, nível e as conquistas como ícones. Clicar filtra a pessoa. */
export function SeasonTable({ table, picked, onPick, className }: { table: SeasonLine[]; picked: string; onPick: (o: string) => void; className?: string }) {
  return (
    <section id="temporada" aria-label="Tabela da temporada" className={cn("scroll-mt-20", className)}>
      <Surface className="flex h-full flex-col gap-3 p-5">
        <SectionTitle title="Tabela da temporada" hint="Só rodada fechada soma." />
        {table.length ? (
          <ol className="-mx-2 flex flex-col divide-y divide-line">
            {table.map((l, i) => {
              const active = picked === l.owner;
              const gold = l.level.name === "Lenda";
              return (
                <li key={l.owner}>
                  <button
                    type="button"
                    onClick={() => onPick(active ? "todos" : l.owner)}
                    aria-pressed={active}
                    className={cn(
                      "grid w-full grid-cols-[24px_minmax(0,1fr)] items-start gap-x-2 rounded-md px-2 py-3 text-left outline-none motion-safe:transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                      active && "bg-surface-2",
                    )}
                  >
                    <span className="pt-0.5 type-caption tabular-nums text-dim">{i + 1}º</span>
                    <span className="flex min-w-0 flex-col gap-1.5">
                      <span className="flex items-center justify-between gap-3">
                        <span className="truncate type-subtitle text-fg">{l.owner}</span>
                        <span className="flex shrink-0 gap-1" aria-label={`${l.achievements.length} de ${ACHIEVEMENTS.length} conquistas`}>
                          {ACHIEVEMENTS.map((a) => {
                            const Icon = ACH_ICON[a.id];
                            const on = l.achievements.includes(a.id);
                            return <Icon key={a.id} aria-hidden className={cn("size-4", on ? "text-fg" : "text-dim opacity-60")} strokeWidth={1.75} />;
                          })}
                        </span>
                      </span>
                      {/* A barra do nível fica em `fg` fora da Lenda: o ciano é só do herói (D2.2). */}
                      <PlayerLevel xp={l.xp} level={l.level} size="sm" className={cn(!gold && "[&_[role=progressbar]>div]:bg-fg")} />
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        ) : (
          <Empty title="Nenhuma rodada fechada ainda" text="A tabela começa quando a primeira rodada fechar, segunda às 10h." />
        )}
      </Surface>
    </section>
  );
}

/** Conquistas da temporada em lista compacta: quem já destravou cada uma. */
export function Conquistas({ table, className }: { table: SeasonLine[]; className?: string }) {
  return (
    <section aria-label="Conquistas da temporada" className={className}>
      <Surface className="flex h-full flex-col gap-3 p-5">
        <SectionTitle title="Conquistas da temporada" hint="Não dão ponto, marcam o caminho." />
        <ul className="flex flex-col divide-y divide-line">
          {ACHIEVEMENTS.map((a) => {
            const Icon = ACH_ICON[a.id];
            const who = table.filter((l) => l.achievements.includes(a.id)).map((l) => l.owner);
            const progress = a.id === "hat-trick" ? table.filter((l) => l.progress["hat-trick"] && l.viradas > 0) : [];
            const on = who.length > 0;
            return (
              <li key={a.id} className="flex items-center gap-3 py-2.5">
                <span className={cn("shrink-0", on ? "text-fg" : "text-dim")}>
                  {on ? <Icon aria-hidden className="size-4" strokeWidth={1.75} /> : <Lock aria-hidden className="size-4" strokeWidth={1.75} />}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className={cn("type-body font-semibold", on ? "text-fg" : "text-mute")}>{a.name}</span>
                  <span className="type-caption text-dim">{a.how}</span>
                </span>
                <span className="max-w-[40%] shrink-0 truncate text-right type-caption text-mute">
                  {on ? who.join(", ") : progress.length ? progress.map((l) => `${l.owner} ${l.progress["hat-trick"]}`).join(", ") : "ninguém ainda"}
                </span>
              </li>
            );
          })}
        </ul>
      </Surface>
    </section>
  );
}
