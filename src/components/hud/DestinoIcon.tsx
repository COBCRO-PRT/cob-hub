import { Crown, Gauge, House, Map as MapIcon, Receipt, Target, Trophy, Wallet, type LucideIcon } from "lucide-react";
import type { Destino } from "@/lib/destinos";
import { cn } from "@/lib/utils";

export const HUD_ICON: Record<NonNullable<Destino["icon"]>, LucideIcon> = {
  inicio: House,
  placar: Gauge,
  rodada: Trophy,
  missoes: Target,
  mapa: MapIcon,
  temporada: Crown,
  notas: Receipt,
  financeiro: Wallet,
};

/** Ícone da tela do hub; ferramenta de fora usa a letra do card da home. */
export function DestinoIcon({ d, active = false }: { d: Destino; active?: boolean }) {
  const box = cn(
    "flex size-9 shrink-0 items-center justify-center rounded-md motion-safe:transition-colors",
    active ? "bg-accent text-accent-fg" : "bg-surface-2 text-mute shadow-relief",
  );
  if (d.icon) {
    const Icon = HUD_ICON[d.icon];
    return (
      <span className={box}>
        <Icon aria-hidden className="size-[18px]" strokeWidth={1.75} />
      </span>
    );
  }
  return <span className={cn(box, "type-subtitle font-extrabold")}>{d.mark ?? d.name.charAt(0)}</span>;
}
