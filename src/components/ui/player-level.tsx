import type { Level } from "@/lib/placar/rodada-rules";
import { cn } from "@/lib/utils";
import { Bar } from "./bar";

/** Nível e XP do jogador (§5). Lenda é o único lugar com dourado. */
export function PlayerLevel({ xp, level, size = "sm", className }: { xp: number; level: Level; size?: "sm" | "md"; className?: string }) {
  const gold = level.name === "Lenda";
  const span = level.next === null ? 1 : level.next - level.from;
  const done = level.next === null ? 1 : Math.max(0, xp - level.from);
  const missing = level.next === null ? null : Math.max(0, level.next - xp);
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <div className={cn("flex items-baseline justify-between gap-3", size === "sm" ? "type-caption" : "type-body font-medium")}>
        <span className={cn("truncate", gold ? "text-gold" : "text-mute")}>
          NV {level.n} · {level.name}
        </span>
        <span className="shrink-0 tabular-nums text-dim">{xp} XP</span>
      </div>
      <Bar value={done} max={span} tone={gold ? "warn" : "accent"} size={size === "sm" ? "sm" : "md"} label={`${xp} XP, nível ${level.n}`} className={gold ? "[&>div]:bg-gold" : undefined} />
      {size === "md" && missing !== null && <span className="type-caption text-dim">faltam {missing} XP para o próximo nível</span>}
    </div>
  );
}
