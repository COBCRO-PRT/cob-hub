import type { Tone } from "@/lib/placar/score";
import { cn } from "@/lib/utils";

const BG: Record<Tone, string> = { good: "bg-good", warn: "bg-warn", bad: "bg-bad", none: "bg-none" };

/** Histórico das últimas rodadas como barrinhas (§5): altura = nota, cor = tom, a mais antiga à esquerda. */
export function Trail({
  tones,
  scores,
  size = "sm",
  label = "Últimas rodadas",
  className,
}: {
  tones: Tone[];
  scores?: (number | null)[];
  size?: "sm" | "md";
  label?: string;
  className?: string;
}) {
  const h = size === "sm" ? "h-3.5" : "h-5";
  const w = size === "sm" ? "w-1.5" : "w-2";
  return (
    <span role="img" aria-label={label} className={cn("inline-flex items-end gap-[3px]", h, className)}>
      {tones.map((t, i) => {
        const s = scores?.[i] ?? null;
        const pct = s === null ? 25 : Math.max(25, Math.min(100, (s / 10) * 100));
        const last = i === tones.length - 1;
        return (
          <i
            key={i}
            className={cn("block rounded-[2px]", w, BG[t], t === "none" ? "opacity-40" : last ? "opacity-100" : "opacity-70")}
            style={{ height: `${pct}%` }}
          />
        );
      })}
    </span>
  );
}
