import { Tile } from "@/components/Tile";
import { SectionTitle } from "@/components/ui";
import type { Shelf } from "@/lib/catalog";
import { cn } from "@/lib/utils";

/** Prateleira (§6.2). Rola no dedo no celular, de borda a borda; no desktop vira grade e cabe inteira. */
export function ShelfRow({ shelf, start = 1 }: { shelf: Shelf; start?: number }) {
  return (
    <section className="flex flex-col gap-4">
      <SectionTitle title={shelf.title} hint={shelf.hint} />
      {/* O carrossel sai do contêiner no celular (margem negativa) e o scroll-px acompanha, senão o snap encosta o primeiro card na borda. */}
      <div
        className={cn(
          "-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-2 sm:-mx-6 sm:scroll-px-6 sm:px-6 lg:mx-0 lg:grid lg:overflow-visible lg:px-0 lg:pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          shelf.items.length === 5 ? "lg:grid-cols-5" : "lg:grid-cols-4",
        )}
      >
        {shelf.items.map((item, i) => (
          <Tile key={item.id} item={item} hotkey={start + i <= 9 ? start + i : undefined} />
        ))}
      </div>
    </section>
  );
}
