import { BRAND_MARK, type Shortcut } from "@/lib/catalog";

/**
 * Card de atalho. Sem logo de terceiro: o reconhecimento vem da letra gigante
 * ao fundo e do endereço no rodapé, que diz pra onde a pessoa vai antes de clicar.
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
      className="group relative flex aspect-[16/11] w-[268px] shrink-0 snap-start flex-col justify-between overflow-hidden rounded-2xl border border-white/10 bg-[#0c0e11] p-5 transition duration-200 hover:-translate-y-1 hover:border-[#00e5ff] focus-visible:-translate-y-1 focus-visible:border-[#00e5ff] focus-visible:outline-none sm:w-[292px] lg:aspect-auto lg:min-h-[184px] lg:w-full"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -right-3 -top-10 select-none text-[152px] font-extrabold leading-none tracking-tighter text-white/[0.05] transition group-hover:text-[#00e5ff]/15"
      >
        {BRAND_MARK[item.brand]}
      </span>

      <div className="relative flex flex-col gap-1.5">
        <h3 className="text-[19px] font-bold leading-tight tracking-tight text-white">
          {item.name}
        </h3>
        <p className="text-[13.5px] leading-snug text-zinc-400">{item.what}</p>
      </div>

      <div className="relative mt-4">
        <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-3">
          <span className="truncate font-mono text-[11px] tracking-wide text-zinc-500">
            {item.host}
          </span>
          <span className="flex shrink-0 items-center gap-2 font-mono text-[11px] font-semibold text-zinc-500 transition group-hover:text-[#00e5ff]">
            {hotkey && (
              <kbd
                title={`Aperte ${hotkey} para abrir`}
                className="hidden size-5 items-center justify-center rounded border border-white/15 text-[11px] text-zinc-300 group-hover:border-[#00e5ff]/60 lg:inline-flex"
              >
                {hotkey}
              </kbd>
            )}
            abrir →
          </span>
        </div>

        {item.note && (
          <span className="mt-2 block font-mono text-[10.5px] leading-tight text-amber-400/80">
            {item.note}
          </span>
        )}
      </div>
    </a>
  );
}
