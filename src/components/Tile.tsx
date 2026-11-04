import { ArrowUpRight } from "lucide-react";
import { Kbd, Pill, Surface } from "@/components/ui";
import { BRAND_MARK, type Shortcut } from "@/lib/catalog";

/**
 * Card de atalho (D2.5): letra da marca em caixa de 36px, nome, o que se faz ali e o endereço no
 * rodapé. A tecla continua funcionando; só aparece no hover e no `title`.
 */
export function Tile({ item, hotkey }: { item: Shortcut; hotkey?: number }) {
  // Tela do próprio hub abre na mesma aba, com a casca; ferramenta de fora, em aba nova.
  const external = !item.url.startsWith("/");
  return (
    <Surface
      as="a"
      light
      interactive
      href={item.url}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      title={hotkey ? `${item.name} (tecla ${hotkey})` : item.name}
      aria-keyshortcuts={hotkey ? String(hotkey) : undefined}
      className="group flex min-h-[10.5rem] flex-col justify-between gap-5 p-5 motion-safe:hover:-translate-y-0.5"
    >
      <div className="flex items-start gap-3">
        <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-2 type-subtitle text-mute shadow-relief">
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
          <span className="flex shrink-0 items-center gap-2 type-caption text-dim motion-safe:transition-colors group-hover:text-fg">
            {hotkey && <Kbd className="hidden lg:group-hover:inline-flex lg:group-focus-visible:inline-flex">{hotkey}</Kbd>}
            abrir
            <ArrowUpRight aria-hidden className="size-3.5" strokeWidth={1.75} />
          </span>
        </div>
      </div>
    </Surface>
  );
}
