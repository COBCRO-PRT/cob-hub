"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { dur, ease } from "./motion";

const R = 44;
const CX = 50;
const CY = 50;
// Meio-anel de 180°: do ponto esquerdo ao direito, passando por cima.
const ARC = `M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`;
const LEN = Math.PI * R;

/**
 * Medidor em meio-anel (D2.4) para a meta do time: valor de 0 a 100, traço da meta em `marker`.
 * Só no gesto-herói do Início e da Rodada.
 */
export function Gauge({
  value,
  marker,
  size = 200,
  label,
  children,
  className,
}: {
  value: number;
  marker?: number;
  size?: number;
  label: string;
  /** O que fica dentro do arco (número e legenda). */
  children?: React.ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const frac = Math.max(0, Math.min(1, value / 100));
  const offset = LEN * (1 - frac);
  const mk = marker === undefined ? null : Math.PI * (1 - Math.max(0, Math.min(1, marker / 100)));
  return (
    <div role="img" aria-label={label} className={cn("relative shrink-0", className)} style={{ width: size, height: size / 2 + 8 }}>
      <svg viewBox="0 0 100 56" className="absolute inset-0 size-full overflow-visible" aria-hidden>
        <path d={ARC} fill="none" strokeWidth={7} strokeLinecap="round" className="stroke-line" />
        <motion.path
          d={ARC}
          fill="none"
          strokeWidth={7}
          strokeLinecap="round"
          strokeDasharray={LEN}
          className="stroke-accent drop-shadow-[0_0_10px_var(--color-accent-soft)]"
          initial={{ strokeDashoffset: reduce ? offset : LEN }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: dur.slow, ease: ease.quint }}
        />
        {mk !== null && (
          <line
            x1={CX + (R - 7) * Math.cos(mk)}
            y1={CY - (R - 7) * Math.sin(mk)}
            x2={CX + (R + 7) * Math.cos(mk)}
            y2={CY - (R + 7) * Math.sin(mk)}
            strokeWidth={2}
            strokeLinecap="round"
            className="stroke-fg"
          />
        )}
      </svg>
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center justify-end text-center">{children}</div>
    </div>
  );
}
