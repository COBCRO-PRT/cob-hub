"use client";

import { motion, useReducedMotion } from "motion/react";
import type { Tone } from "@/lib/placar/score";
import { cn } from "@/lib/utils";
import { dur, ease } from "./motion";

export type ColumnSeries = { key: string; label: string; values: Partial<Record<Tone, number>> };

const ORDER: Tone[] = ["good", "warn", "bad", "none"];
const FILL: Record<Tone, string> = { good: "bg-good", warn: "bg-warn", bad: "bg-bad", none: "bg-line-strong" };

/**
 * O gráfico-herói (D2.4): colunas empilhadas por tom, uma por semana ou rodada.
 * A coluna `highlight` ganha o halo de acento; as outras ficam quietas.
 */
export function Columns({
  series,
  highlight,
  height = 220,
  onPick,
  label,
  compact = false,
  className,
}: {
  series: ColumnSeries[];
  highlight?: string;
  height?: number;
  onPick?: (key: string) => void;
  label: string;
  /** Sem os totais em cima de cada coluna (gráfico pequeno dentro do herói). */
  compact?: boolean;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const totals = series.map((s) => ORDER.reduce((n, t) => n + (s.values[t] ?? 0), 0));
  const max = Math.max(1, ...totals);
  return (
    <div role={onPick ? "group" : "img"} aria-label={label} className={cn("flex w-full items-end gap-2 sm:gap-3", className)} style={{ height: height + (compact ? 20 : 28) }}>
      {series.map((s, i) => {
        const on = s.key === highlight;
        const Tag = onPick ? "button" : "div";
        return (
          <Tag
            key={s.key}
            type={onPick ? "button" : undefined}
            onClick={onPick ? () => onPick(s.key) : undefined}
            aria-label={onPick ? `${s.label}: ${totals[i]}` : undefined}
            className={cn(
              "group relative flex min-w-0 flex-1 flex-col items-center justify-end gap-2 rounded-md outline-none",
              onPick && "cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
            )}
            style={{ height: height + (compact ? 20 : 28) }}
          >
            {on && <span aria-hidden className="pointer-events-none absolute inset-x-[-30%] top-0 bottom-6 bg-glow-accent" />}
            {!compact && <span className={cn("type-caption tabular-nums", on ? "text-fg" : "text-dim")}>{totals[i]}</span>}
            <div className="relative flex w-full max-w-[44px] flex-col-reverse overflow-hidden rounded-sm" style={{ height }}>
              {ORDER.map((t) => {
                const v = s.values[t] ?? 0;
                if (!v) return null;
                const pct = (v / max) * 100;
                return (
                  <motion.span
                    key={t}
                    className={cn("block w-full", FILL[t], !on && "opacity-70 group-hover:opacity-100 motion-safe:transition-opacity")}
                    initial={{ height: reduce ? `${pct}%` : 0 }}
                    animate={{ height: `${pct}%` }}
                    transition={{ duration: dur.slow, ease: ease.quint, delay: reduce ? 0 : i * 0.03 }}
                  />
                );
              })}
            </div>
            <span className={cn("type-caption truncate", on ? "text-fg" : "text-dim")}>{s.label}</span>
          </Tag>
        );
      })}
    </div>
  );
}
