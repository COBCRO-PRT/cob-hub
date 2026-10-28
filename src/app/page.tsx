import { cookies } from "next/headers";
import { ShelfRow } from "@/components/ShelfRow";
import { TeclasDaHome } from "@/components/TeclasDaHome";
import { Continuar } from "@/components/hud/Continuar";
import { USER_COOKIE_NAME, readSession } from "@/lib/gate-pessoa";
import { SECUNDARIOS, SHELVES } from "@/lib/catalog";

/** Tela inicial: continuar a rodada, os cards numerados e o rodapé. A barra do jogo vem do layout. */
export default async function Home() {
  const pessoa = await readSession((await cookies()).get(USER_COOKIE_NAME)?.value);
  const starts = SHELVES.map((_, i) => 1 + SHELVES.slice(0, i).reduce((n, s) => n + s.items.length, 0));
  const urls = SHELVES.flatMap((s) => s.items.map((it) => it.url)).slice(0, 9);

  return (
    <div className="min-h-screen bg-[#07080a]">
      <TeclasDaHome urls={urls} />
      <main className="flex flex-col gap-12 pb-24 pt-10">
        <section className="flex flex-col gap-6 px-6 lg:px-10">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500">
              Uso interno
            </p>
            <h1 className="mt-3 max-w-[18ch] text-[clamp(34px,6vw,58px)] font-extrabold leading-[0.98] tracking-[-0.04em] text-white">
              Tudo que o time usa,{" "}
              <span className="text-[#00e5ff]">em um lugar só</span>
            </h1>
            <p className="mt-4 max-w-[60ch] text-[16px] leading-relaxed text-zinc-400">
              Todo pedido começa no ClickUp, vira tarefa no Dynamic, passa pela
              aprovação e volta pro ClickUp pra entregar.
              <span className="hidden sm:inline">
                {" "}Aperte o número do card para abrir, ou{" "}
                <kbd className="rounded border border-white/15 px-1.5 font-mono text-[13px] text-zinc-200">/</kbd> para achar
                qualquer lugar.
              </span>
            </p>
          </div>
          <Continuar pessoa={pessoa ? { name: pessoa.name, role: pessoa.role } : null} />
        </section>

        {SHELVES.map((shelf, i) => (
          <div key={shelf.id} id={shelf.id} className="scroll-mt-24">
            <ShelfRow shelf={shelf} start={starts[i]} />
          </div>
        ))}
      </main>

      <footer className="border-t border-white/[0.07] px-6 py-8 lg:px-10">
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-zinc-500">
          Quando precisar
        </p>
        <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
          {SECUNDARIOS.map((item) => (
            <li key={item.id}>
              <a
                href={item.url}
                title={item.what}
                className="text-[14px] text-zinc-400 underline-offset-4 transition hover:text-white hover:underline"
              >
                {item.name}
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-8 font-mono text-[11px] uppercase tracking-[0.08em] text-zinc-600">
          COB · link quebrado ou ferramenta faltando, fala com o Matheus
        </p>
      </footer>
    </div>
  );
}
