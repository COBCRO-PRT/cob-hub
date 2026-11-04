import { Medal } from "lucide-react";
import { Pill, type PillTone } from "@/components/ui";
import { TIER_LABEL } from "@/lib/placar/degrau";
import type { Tier } from "@/lib/placar/types";
import { cn } from "@/lib/utils";

/** Cara de cada degrau: Ouro no tom quente dos tokens, Prata em `fg`, Bronze quieto, Abaixo pede atenção. */
const TIER_STYLE: Record<Exclude<Tier, "">, { tone: PillTone; icon?: boolean }> = {
  ouro: { tone: "gold", icon: true },
  prata: { tone: "strong" },
  bronze: { tone: "neutral" },
  abaixo: { tone: "warn" },
};

/**
 * Chip do degrau do benchmark (docs/placar-benchmark.md), com a leitura de custo ao lado quando há.
 * Sem degrau vira "a medir" em caption apagada, para a lista não encher de chip vazio.
 */
export function TierChip({ tier, read, className }: { tier: Tier; read?: string | null; className?: string }) {
  if (!tier) {
    return (
      <span className={cn("type-caption text-dim", className)} title="Sem leitura de degrau nesta janela">
        a medir
      </span>
    );
  }
  const s = TIER_STYLE[tier];
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5", className)}>
      <Pill tone={s.tone} icon={s.icon ? <Medal aria-hidden strokeWidth={1.75} /> : undefined} aria-label={`Degrau ${TIER_LABEL[tier]}`}>
        {TIER_LABEL[tier]}
      </Pill>
      {read && <span className="truncate type-caption tabular-nums text-mute">{read}</span>}
    </span>
  );
}
