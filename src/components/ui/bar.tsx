"use client";

import { motion, useReducedMotion } from "motion/react";
import type { Tone } from "@/lib/placar/score";
import { cn } from "@/lib/utils";
import { dur, ease } from "./motion";

const FILL: Record<Tone | "accent" | "fg", string> = { good: "bg-good", warn: "bg-warn", bad: "bg-bad", none: "bg-none", accent: "bg-accent", fg: "bg-fg" };

/** A única barra de progresso (§5). Enche uma vez ao entrar; depois interpola. `marker` é o traço da meta. Sem `label` é decorativa (aria-hidden). */
export function Bar({
  value,
  max,
  tone = "accent",
  size = "sm",
  marker,
  label,
  className,
}: {
  value: number;
  max: number;
  tone?: Tone | "accent" | "fg";
  size?: "sm" | "md";
  marker?: number;
  label?: string;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const mk = marker !== undefined && max > 0 ? Math.max(0, Math.min(100, (marker / max) * 100)) : null;
  return (
    <div
      role={label ? "progressbar" : undefined}
      aria-hidden={label ? undefined : true}
      aria-valuenow={label ? Math.round(value) : undefined}
      aria-valuemin={label ? 0 : undefined}
      aria-valuemax={label ? Math.round(max) : undefined}
      aria-label={label}
      className={cn("relative w-full overflow-hidden rounded-full bg-line", size === "sm" ? "h-1" : "h-2", className)}
    >
      <motion.div
        className={cn("h-full rounded-full", FILL[tone])}
        initial={{ width: reduce ? `${pct}%` : 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: dur.slow, ease: ease.quint }}
      />
      {mk !== null && <span aria-hidden className="absolute inset-y-0 w-0.5 bg-fg/60" style={{ left: `${mk}%` }} />}
    </div>
  );
}
