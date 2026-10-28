"use client";

import { motion, useReducedMotion } from "motion/react";
import type { Tone } from "@/lib/placar/score";
import { cn } from "@/lib/utils";
import { dur, ease } from "./motion";

const FILL: Record<Tone | "accent", string> = { good: "bg-good", warn: "bg-warn", bad: "bg-bad", none: "bg-none", accent: "bg-accent" };

/** A única barra de progresso (§5). Enche uma vez ao entrar; depois interpola. `marker` é o traço da meta. */
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
  tone?: Tone | "accent";
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
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={Math.round(max)}
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
