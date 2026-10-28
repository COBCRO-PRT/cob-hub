import { ArrowUpRight } from "lucide-react";
import { Kbd, Pill } from "@/components/ui";
import { BRAND_MARK, type Shortcut } from "@/lib/catalog";
import { cn } from "@/lib/utils";

/**
 * Card de atalho (§6.2): marca em caixa, nome, o que se faz ali, e o endereço no rodapé
 * para a pessoa saber para onde vai antes de clicar.
 */
export function Tile({ item, hotkey }: { item: Shortcut; hotkey?: number }) {
  // Tela do próprio hub abre na mesma aba, com a barra do jogo; ferramenta de fora, em aba nova.
  const external = !item.url.startsWith("/");
  return (
    <a
      href={item.url}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      aria-keyshortcuts={hotkey ? String(hotkey) : undefined}
      className={cn(
        "group flex w-[268px] shrink-0 snap-start flex-col justify-between gap-5 rounded-card border border-line bg-surface-1 p-5 shadow-relief outline-none",
        "motion-safe:transition-[background-color,border-color,transform] hover:border-line-strong hover:bg-surface-3 motion-safe:hover:-translate-y-0.5 motion-safe:active:scale-[0.985]",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:w-[292px] lg:min-h-[176px] lg:w-full",
      )}
    >
      <div className="flex items-start gap-3">
        <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-2 type-subtitle font-extrabold text-mute shadow-relief motion-safe:transition-colors group-hover:bg-accent group-hover:text-accent-fg">
          {BRAND_MARK[item.brand]}
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="type-subtitle text-fg">{item.name}</h3>
          <p className="type-body text-mute">{item.what}</p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {item.note && <Pill tone="warn" className="h-auto min-h-6 self-start whitespace-normal py-0.5 text-left">{item.note}</Pill>}
        <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
          <span className="truncate font-mono type-caption text-dim">{item.host}</span>
          <span className="flex shrink-0 items-center gap-2 type-caption text-dim motion-safe:transition-colors group-hover:text-accent-text">
            {hotkey && <Kbd className="hidden lg:inline-flex">{hotkey}</Kbd>}
            abrir
            <ArrowUpRight aria-hidden className="size-3.5" strokeWidth={1.75} />
          </span>
        </div>
      </div>
    </a>
  );
}
