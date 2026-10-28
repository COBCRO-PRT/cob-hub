"use client";

import { useEffect, useState } from "react";
import { animate, useMotionValue, useMotionValueEvent, useReducedMotion } from "motion/react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import type { Tone } from "@/lib/placar/score";
import { cn } from "@/lib/utils";
import { dur, ease } from "./motion";

const TEXT: Record<Tone, string> = { good: "text-good", warn: "text-warn", bad: "text-bad", none: "text-dim" };

export const fmtNumber = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

/** KPI (§5). Conta uma vez na primeira pintura; depois desliza do valor antigo ao novo. `null` mostra "s/n". */
export function Metric({
  value,
  format = fmtNumber,
  unit,
  label,
  sub,
  tone,
  size = "md",
  delta,
  className,
}: {
  value: number | null;
  format?: (n: number) => string;
  unit?: string;
  label: string;
  sub?: string;
  tone?: Tone;
  size?: "lg" | "md";
  delta?: { value: number; label: string };
  className?: string;
}) {
  const reduce = useReducedMotion();
  const mv = useMotionValue(reduce ? (value ?? 0) : 0);
  const [text, setText] = useState(() => (value === null ? null : format(reduce ? value : 0)));

  useEffect(() => {
    if (value === null) return;
    if (reduce) {
      mv.set(value);
      return;
    }
    const c = animate(mv, value, { duration: dur.slow, ease: ease.quint });
    return () => c.stop();
  }, [value, reduce, mv, format]);

  useMotionValueEvent(mv, "change", (v) => setText(format(v)));

  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <span className="type-caption text-mute">{label}</span>
      <span className={cn("flex items-baseline gap-1.5", size === "lg" ? "type-metric-lg" : "type-metric", value === null ? "text-dim" : tone ? TEXT[tone] : "text-fg")}>
        {value === null ? "s/n" : text}
        {unit && value !== null && <span className="type-caption text-dim">{unit}</span>}
      </span>
      {(sub || delta) && (
        <span className="flex flex-wrap items-center gap-x-2 type-caption text-dim">
          {delta && (
            <span className={cn("inline-flex items-center gap-0.5", delta.value > 0 ? "text-good" : delta.value < 0 ? "text-bad" : "text-dim")}>
              {delta.value > 0 ? <ArrowUpRight aria-hidden className="size-3" /> : delta.value < 0 ? <ArrowDownRight aria-hidden className="size-3" /> : null}
              {delta.label}
            </span>
          )}
          {sub}
        </span>
      )}
    </div>
  );
}
