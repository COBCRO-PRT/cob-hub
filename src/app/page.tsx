import { cookies } from "next/headers";
import { ShelfRow } from "@/components/ShelfRow";
import { TeclasDaHome } from "@/components/TeclasDaHome";
import { Continuar } from "@/components/hud/Continuar";
import { CONTAINER, Label } from "@/components/ui";
import { USER_COOKIE_NAME, readSession } from "@/lib/gate-pessoa";
import { SECUNDARIOS, SHELVES } from "@/lib/catalog";
import { SEASON, roundOf } from "@/lib/placar/rodada-rules";
import { mondayOf } from "@/lib/placar/score";

const TZ = "America/Sao_Paulo";

function saudacao(now: Date) {
  const h = Number(new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hour12: false, timeZone: TZ }).format(now));
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

/** Tela de partida (§6.2): saudação, o cartão da rodada e as prateleiras. A barra do jogo vem do layout. */
export default async function Home() {
  const pessoa = await readSession((await cookies()).get(USER_COOKIE_NAME)?.value);
  const starts = SHELVES.map((_, i) => 1 + SHELVES.slice(0, i).reduce((n, s) => n + s.items.length, 0));
  const urls = SHELVES.flatMap((s) => s.items.map((it) => it.url)).slice(0, 9);
  const now = new Date();
  const data = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: TZ }).format(now);
  const round = roundOf(mondayOf(now));

  return (
    <div className="min-h-screen bg-bg">
      <TeclasDaHome urls={urls} />
      <main className={`${CONTAINER} flex flex-col gap-10`}>
        <section className="flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <h1 className="type-title text-fg">
              {pessoa ? `${saudacao(now)}, ${pessoa.name}` : "Olá"}
            </h1>
            <Label>
              {data}
              {round ? ` · ${SEASON.name} · rodada ${round} de ${SEASON.rounds}` : ""}
            </Label>
          </div>
          <Continuar pessoa={pessoa ? { name: pessoa.name, role: pessoa.role } : null} />
        </section>

        {SHELVES.map((shelf, i) => (
          <div key={shelf.id} id={shelf.id} className="scroll-mt-20">
            <ShelfRow shelf={shelf} start={starts[i]} />
          </div>
        ))}

        <footer className="flex flex-col gap-4 border-t border-line pt-8">
          <Label>Quando precisar</Label>
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {SECUNDARIOS.map((item) => (
              <li key={item.id}>
                <a
                  href={item.url}
                  className="type-body text-mute underline-offset-4 outline-none motion-safe:transition-colors hover:text-fg hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  {item.name}
                </a>
                <span className="type-caption text-dim"> · {item.what}</span>
              </li>
            ))}
          </ul>
          <p className="type-caption text-dim">Link quebrado ou ferramenta faltando, fala com o Matheus.</p>
        </footer>
      </main>
    </div>
  );
}
