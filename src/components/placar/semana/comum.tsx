"use client";

import { useEffect, useState } from "react";
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
import type { PillTone } from "@/components/ui";
import type { AchievementId } from "@/lib/placar/rodada-rules";
import type { MissionKind } from "@/lib/placar/jogo";
import type { RodadaTone } from "@/lib/placar/types";

export const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);
export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
/** Segunda da semana como "26/10", para o eixo de gráfico curto. */
export const shortWeek = (week: string) => `${week.slice(8, 10)}/${week.slice(5, 7)}`;

/** Link externo (ClickUp) num `Button href`: o tipo do botão não conhece `target`, então entra por spread. */
export const EXTERNAL_LINK = { target: "_blank", rel: "noreferrer" } as object;

/** Nome de cada faixa, para legenda e leitor de tela. */
export const TONE_LABEL: Record<RodadaTone, string> = { good: "Verde", warn: "Amarelo", bad: "Vermelho", none: "Cinza" };

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

/** Cara de cada tipo de missão: rótulo, ícone e o tom do chip (§6.4). Sem ciano: o acento fica só no herói (D2.2). */
export const KIND: Record<MissionKind, { label: string; icon: LucideIcon; tone: PillTone }> = {
  virada: { label: "Virar", icon: TrendingUp, tone: "bad" },
  selo: { label: "Selo de indicação", icon: Award, tone: "neutral" },
  segurar: { label: "Segurar o verde", icon: Shield, tone: "warn" },
  verde: { label: "Chegar no verde", icon: Target, tone: "good" },
  cinza: { label: "Tirar do cinza", icon: PenLine, tone: "none" },
};

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
