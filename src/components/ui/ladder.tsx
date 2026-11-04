"use client";

import { motion, useReducedMotion } from "motion/react";
import type { Tier } from "@/lib/placar/types";
import { cn } from "@/lib/utils";
import { dur, ease } from "./motion";

export interface LadderMark {
  /** Posição na escala (custo em R$ ou retorno em x). */
  at: number;
  /** Nome curto do marco ("Ouro p25", "p75"). */
  label: string;
  /** Valor escrito ("R$ 6,24"). */
  text: string;
}

interface Zone {
  from: number;
  to: number;
  tier: Tier;
}

const ZONE: Record<Tier, string> = {
  ouro: "bg-gold/30",
  prata: "bg-fg/20",
  bronze: "bg-warn/25",
  abaixo: "bg-bad/20",
  "": "bg-line",
};

/** Faixas da régua a partir dos degraus (limite de cada um), do melhor ao pior. */
function zonesOf(steps: { tier: Tier; limit: number }[], better: "low" | "high", max: number): Zone[] {
  const asc = [...steps].sort((a, b) => a.limit - b.limit);
  const out: Zone[] = [];
  if (better === "low") {
    let from = 0;
    for (const s of asc) {
      out.push({ from, to: s.limit, tier: s.tier });
      from = s.limit;
    }
    out.push({ from, to: max, tier: "abaixo" });
  } else {
    let from = 0;
    for (let i = 0; i < asc.length; i++) {
      out.push({ from, to: asc[i].limit, tier: i === 0 ? "abaixo" : asc[i - 1].tier });
      from = asc[i].limit;
    }
    out.push({ from, to: max, tier: asc[asc.length - 1]?.tier ?? "abaixo" });
  }
  return out.filter((z) => z.to > z.from);
}

/**
 * Régua do mercado (docs/placar-benchmark.md): faixas de cada degrau, marcos da
 * curva (p25, p50, p75, Bronze da COB) e o marcador do cliente. `better` diz
 * para que lado a escala melhora: custo cai ("low"), retorno sobe ("high").
 */
export function Ladder({
  value,
  valueText,
  steps,
  marks,
  better,
  label,
  className,
}: {
  value: number | null;
  valueText?: string;
  steps: { tier: Tier; limit: number }[];
  marks: LadderMark[];
  better: "low" | "high";
  label: string;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const top = Math.max(...marks.map((m) => m.at), ...steps.map((s) => s.limit), value ?? 0, 0);
  const max = top > 0 ? top * 1.15 : 1;
  const pct = (v: number) => Math.max(0, Math.min(100, (v / max) * 100));
  const zones = zonesOf(steps, better, max);
  // Rótulos alternam entre duas linhas quando dois marcos ficam perto demais.
  const sorted = [...marks].sort((a, b) => a.at - b.at);
  const rows = sorted.reduce<number[]>((acc, m, i) => {
    const near = i > 0 && pct(m.at) - pct(sorted[i - 1].at) < 16;
    acc.push(near && acc[i - 1] === 0 ? 1 : 0);
    return acc;
  }, []);
  const vp = value === null ? null : pct(value);

  return (
    <div role="img" aria-label={label} className={cn("flex flex-col gap-1 px-6 pt-5", className)}>
      <div className="relative h-2 w-full rounded-full bg-line">
        {zones.map((z, i) => (
          <span
            key={i}
            aria-hidden
            className={cn("absolute inset-y-0", ZONE[z.tier], i === 0 && "rounded-l-full", i === zones.length - 1 && "rounded-r-full")}
            style={{ left: `${pct(z.from)}%`, width: `${pct(z.to) - pct(z.from)}%` }}
          />
        ))}
        {sorted.map((m) => (
          <span key={m.label} aria-hidden className="absolute -inset-y-1 w-0.5 -translate-x-1/2 rounded-full bg-fg/60" style={{ left: `${pct(m.at)}%` }} />
        ))}
        {vp !== null && (
          <motion.span
            aria-hidden
            className="absolute top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
            initial={{ left: reduce ? `${vp}%` : "0%" }}
            animate={{ left: `${vp}%` }}
            transition={{ duration: dur.slow, ease: ease.quint }}
          >
            <span className="absolute bottom-full mb-1.5 whitespace-nowrap type-caption font-semibold text-fg">{valueText}</span>
            <span className="block size-3.5 rounded-full bg-fg shadow-float ring-2 ring-surface-1" />
          </motion.span>
        )}
      </div>
      <div className="relative h-14 w-full">
        {sorted.map((m, i) => (
          <span
            key={m.label}
            aria-hidden
            className={cn("absolute flex -translate-x-1/2 flex-col items-center whitespace-nowrap leading-tight", rows[i] === 0 ? "top-0" : "top-7")}
            style={{ left: `${pct(m.at)}%` }}
          >
            <span className="type-caption text-dim">{m.label}</span>
            <span className="type-caption font-medium text-mute">{m.text}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
