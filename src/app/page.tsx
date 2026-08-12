import { ShelfRow } from "@/components/ShelfRow";
import { SHELVES } from "@/lib/catalog";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <header className="sticky top-0 z-30 border-b border-white/[0.07] bg-[#0a0a0a]/90 backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-6 py-4 lg:px-10">
          <span className="text-[20px] font-extrabold tracking-[-0.03em] text-white">
            CO-B<span className="text-[#c0de1b]">.</span>
          </span>
          <nav className="flex flex-wrap items-center gap-x-4 gap-y-1 sm:gap-x-5">
            {SHELVES.map((shelf) => (
              <a
                key={shelf.id}
                href={`#${shelf.id}`}
                className="font-mono text-[11px] uppercase tracking-[0.12em] text-zinc-500 transition hover:text-white"
              >
                {shelf.title}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <main className="flex flex-col gap-12 pb-24 pt-10">
        <section className="px-6 lg:px-10">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500">
            Uso interno
          </p>
          <h1 className="mt-3 max-w-[18ch] text-[clamp(34px,6vw,58px)] font-extrabold leading-[0.98] tracking-[-0.04em] text-white">
            Tudo que o time usa,{" "}
            <span className="text-[#c0de1b]">em um lugar só</span>
          </h1>
          <p className="mt-4 max-w-[52ch] text-[16px] leading-relaxed text-zinc-400">
            Todo pedido começa no ClickUp, vira tarefa no Dynamic, passa pela
            aprovação e volta pro ClickUp pra entregar. Escolha por onde
            continuar.
          </p>
        </section>

        {SHELVES.map((shelf) => (
          <div key={shelf.id} id={shelf.id} className="scroll-mt-24">
            <ShelfRow shelf={shelf} />
          </div>
        ))}
      </main>

      <footer className="border-t border-white/[0.07] px-6 py-6 lg:px-10">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-zinc-600">
          COB · link quebrado ou ferramenta faltando, fala com o Matheus
        </p>
      </footer>
    </div>
  );
}
