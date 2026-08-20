import { BRAND_MARK, type Shortcut } from "@/lib/catalog";

/**
 * Card de atalho. Sem logo de terceiro: o reconhecimento vem da letra gigante
 * ao fundo e do endereço no rodapé, que diz pra onde a pessoa vai antes de clicar.
 */
export function Tile({ item }: { item: Shortcut }) {
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative flex aspect-[16/11] w-[268px] shrink-0 snap-start flex-col justify-between overflow-hidden rounded-2xl border border-white/10 bg-[#141414] p-5 transition duration-200 hover:-translate-y-1 hover:border-[#c0de1b] focus-visible:-translate-y-1 focus-visible:border-[#c0de1b] focus-visible:outline-none sm:w-[292px] lg:aspect-auto lg:min-h-[184px] lg:w-full"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -right-3 -top-10 select-none text-[152px] font-extrabold leading-none tracking-tighter text-white/[0.05] transition group-hover:text-[#c0de1b]/15"
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
          <span className="shrink-0 font-mono text-[11px] font-semibold text-zinc-500 transition group-hover:text-[#c0de1b]">
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
