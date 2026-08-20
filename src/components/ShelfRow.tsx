import { Tile } from "@/components/Tile";
import type { Shelf } from "@/lib/catalog";

/** Prateleira horizontal. Rola no dedo no celular e cabe inteira no desktop. */
export function ShelfRow({ shelf }: { shelf: Shelf }) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-6 lg:px-10">
        <h2 className="text-[21px] font-bold tracking-tight text-white">
          {shelf.title}
        </h2>
        {shelf.hint && (
          <p className="text-[13.5px] text-zinc-500">{shelf.hint}</p>
        )}
      </div>

      {/* scroll-px acompanha o px: sem ele o snap encosta o primeiro card na borda */}
      {/* Celular rola no dedo, desktop vira grade e ocupa a largura toda */}
      <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-6 px-6 pb-2 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {shelf.items.map((item) => (
          <Tile key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}
