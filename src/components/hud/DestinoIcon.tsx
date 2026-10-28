import { Crown, Gauge, House, Map as MapIcon, Receipt, Target, Trophy, Wallet, type LucideIcon } from "lucide-react";
import type { Destino } from "@/lib/destinos";

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
  const box = `flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors ${active ? "bg-[#00e5ff] text-[#04141a]" : "bg-white/[0.05] text-zinc-300"}`;
  if (d.icon) {
    const Icon = HUD_ICON[d.icon];
    return (
      <span className={box}>
        <Icon aria-hidden className="size-[18px]" strokeWidth={2} />
      </span>
    );
  }
  return <span className={`${box} font-extrabold tracking-tight`}>{d.mark ?? d.name.charAt(0)}</span>;
}
