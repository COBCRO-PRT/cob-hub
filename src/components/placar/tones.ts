import type { Tone } from "@/lib/placar/score";

/** Cor de cada faixa pelos tokens (§4.1). Classe inteira escrita aqui para o Tailwind enxergar. */
export const TONE_STYLE: Record<Tone, { text: string; soft: string; solid: string; border: string; label: string }> = {
  good: { text: "text-good", soft: "bg-good/12", solid: "bg-good", border: "border-good/35", label: "Verde" },
  warn: { text: "text-warn", soft: "bg-warn/12", solid: "bg-warn", border: "border-warn/35", label: "Amarelo" },
  bad: { text: "text-bad", soft: "bg-bad/12", solid: "bg-bad", border: "border-bad/35", label: "Vermelho" },
  none: { text: "text-dim", soft: "bg-none/12", solid: "bg-none", border: "border-line", label: "Cinza" },
};
