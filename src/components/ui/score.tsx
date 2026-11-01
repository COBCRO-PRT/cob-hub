"use client";

import { motion, useReducedMotion } from "motion/react";
import type { Tone } from "@/lib/placar/score";
import { cn } from "@/lib/utils";
import { dur, ease } from "./motion";

const STROKE: Record<Tone, string> = { good: "stroke-good", warn: "stroke-warn", bad: "stroke-bad", none: "stroke-none" };
const TEXT: Record<Tone, string> = { good: "text-good", warn: "text-warn", bad: "text-bad", none: "text-dim" };
const LABEL: Record<Tone, string> = { good: "verde", warn: "amarelo", bad: "vermelho", none: "cinza" };
const FONT: Record<32 | 40 | 56, string> = { 32: "text-xs font-bold tabular-nums", 40: "type-metric-sm", 56: "text-xl font-bold tabular-nums tracking-tight" };

const R = 17;
const C = 2 * Math.PI * R;

export const fmtScore = (n: number) => (n >= 10 ? "10" : n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }));

/** O anel da Arena (§5): nota de 0 a 10 como arco no tom. `null` = anel tracejado com "s/n". */
export function Score({
  value,
  tone,
  size = 40,
  label,
  bare = false,
  className,
}: {
  value: number | null;
  tone: Tone;
  size?: 32 | 40 | 56;
  /** Texto para leitor de tela; padrão "nota 9,2, verde". */
  label?: string;
  /** Só o arco, sem o número dentro (lista densa, D2.4). */
  bare?: boolean;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const frac = value === null ? 0 : Math.max(0, Math.min(1, value / 10));
  const offset = C * (1 - frac);
  return (
    <span
      role="img"
      aria-label={label ?? (value === null ? "sem nota" : `nota ${fmtScore(value)}, ${LABEL[tone]}`)}
      className={cn("relative inline-grid shrink-0 place-items-center", FONT[size], TEXT[tone], className)}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 40 40" className="absolute inset-0 size-full -rotate-90" aria-hidden>
        <circle cx="20" cy="20" r={R} fill="none" strokeWidth={size === 32 ? 4 : 3.5} className="stroke-line" strokeDasharray={value === null ? "2 4" : undefined} />
        {value !== null && (
          <motion.circle
            cx="20"
            cy="20"
            r={R}
            fill="none"
            strokeWidth={size === 32 ? 4 : 3.5}
            strokeLinecap="round"
            strokeDasharray={C}
            className={STROKE[tone]}
            initial={{ strokeDashoffset: reduce ? offset : C }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: dur.slow, ease: ease.quint }}
          />
        )}
      </svg>
      {!bare && <span className="relative">{value === null ? "s/n" : fmtScore(value)}</span>}
    </span>
  );
}
