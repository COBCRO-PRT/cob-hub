"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";
import {
  Award,
  Crown,
  Eye,
  PenLine,
  Shield,
  ShieldCheck,
  Sparkles,
  Target,
  Timer,
  TrendingUp,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { AchievementId } from "@/lib/placar/rodada-rules";
import type { MissionKind } from "@/lib/placar/jogo";
import { fmtScore } from "@/lib/placar/score";
import type { RodadaTone } from "@/lib/placar/types";
import { TONE_STYLE } from "../tones";

export const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);
export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export const ACH_ICON: Record<AchievementId, LucideIcon> = {
  virada: TrendingUp,
  "hat-trick": Zap,
  selo: Award,
  "carteira-lida": Eye,
  "zero-vermelho": ShieldCheck,
  "tudo-verde": Sparkles,
  lider: Crown,
  "plano-72h": Timer,
};

/** Cara de cada tipo de missão. Classe inteira escrita aqui para o Tailwind enxergar. */
export const KIND: Record<MissionKind, { label: string; icon: LucideIcon; text: string; ring: string }> = {
  virada: { label: "Virar", icon: TrendingUp, text: "text-red-300", ring: "border-red-400/30 bg-red-400/[0.06]" },
  selo: { label: "Selo de indicação", icon: Award, text: "text-[#7ff2ff]", ring: "border-[#00e5ff]/35 bg-[#00e5ff]/[0.06]" },
  segurar: { label: "Segurar o verde", icon: Shield, text: "text-amber-300", ring: "border-amber-300/25 bg-amber-300/[0.05]" },
  verde: { label: "Chegar no verde", icon: Target, text: "text-emerald-300", ring: "border-emerald-400/25 bg-emerald-400/[0.05]" },
  cinza: { label: "Tirar do cinza", icon: PenLine, text: "text-zinc-300", ring: "border-white/10 bg-white/[0.02]" },
};

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h2 className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">{children}</h2>
      {right && <span className="text-[12.5px] text-zinc-500">{right}</span>}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-white/10 px-5 py-6 text-center text-[14px] text-zinc-500">
      {children}
    </div>
  );
}

export function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div role="status" className="rounded-xl border border-amber-400/20 bg-amber-400/[0.05] px-5 py-3.5 text-amber-300">
      <p className="text-[13.5px] font-medium">{title}</p>
      <p className="mt-1 text-[12.5px] leading-relaxed opacity-80">{children}</p>
    </div>
  );
}

export function ScoreBadge({ tone, score, size = "md" }: { tone: RodadaTone; score: number | null; size?: "sm" | "md" }) {
  const t = TONE_STYLE[tone];
  const box = size === "sm" ? "h-7 min-w-10 text-[13px]" : "h-9 min-w-12 text-[15px]";
  return (
    <span className={`inline-flex items-center justify-center rounded-lg px-2 font-mono font-semibold tabular-nums ${box} ${t.soft} ${t.text}`}>
      {score === null ? "s/n" : fmtScore(score)}
    </span>
  );
}

/** Bolinhas das últimas rodadas, a mais antiga à esquerda. */
export function TrailDots({ trail, weeks }: { trail: RodadaTone[]; weeks?: string[] }) {
  return (
    <span className="inline-flex items-center gap-1" aria-label="Histórico das últimas rodadas">
      {trail.map((t, i) => (
        <i
          key={i}
          title={weeks?.[i] ? `${weeks[i]}: ${TONE_STYLE[t].label}` : TONE_STYLE[t].label}
          className={`inline-block size-2.5 rounded-full ${TONE_STYLE[t].solid} ${i === trail.length - 1 ? "ring-2 ring-white/25" : "opacity-80"}`}
        />
      ))}
    </span>
  );
}

/** Número que sobe até o valor. Com "reduzir movimento" ligado, aparece direto. */
export function CountUp({ value, ms = 900, delay = 0 }: { value: number; ms?: number; delay?: number }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? value : 0);
  useEffect(() => {
    if (reduce) {
      const t = setTimeout(() => setShown(value), 0);
      return () => clearTimeout(t);
    }
    let raf = 0;
    let start = 0;
    const from = 0;
    const tick = (now: number) => {
      if (!start) start = now;
      const k = Math.min(1, (now - start) / ms);
      setShown(Math.round(from + (value - from) * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    const t = setTimeout(() => (raf = requestAnimationFrame(tick)), delay);
    return () => {
      clearTimeout(t);
      cancelAnimationFrame(raf);
    };
  }, [value, ms, delay, reduce]);
  return <>{shown}</>;
}

/** Relógio que anda a cada `ms`, para a contagem até o fechamento. */
export function useNow(ms = 30_000) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const first = setTimeout(() => setNow(Date.now()), 0);
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [ms]);
  return now;
}

/** Fechamento da rodada `week`: a segunda seguinte às 10h de Brasília (13h UTC). */
export const closesAt = (week: string) => Date.parse(week + "T13:00:00Z") + 7 * 86400000;

export function countdown(ms: number) {
  if (ms <= 0) return "fechando";
  const h = Math.floor(ms / 3600000);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h`;
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${String(m).padStart(2, "0")}min`;
}
