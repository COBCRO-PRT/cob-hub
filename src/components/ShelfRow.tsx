import { Tile } from "@/components/Tile";
import { SectionTitle } from "@/components/ui";
import type { Shelf } from "@/lib/catalog";

/** Prateleira (D2.5): grade de 4 colunas no desktop, 2 no tablet, 1 no celular. */
export function ShelfRow({ shelf, start = 1 }: { shelf: Shelf; start?: number }) {
  return (
    <section className="flex flex-col gap-4">
      <SectionTitle title={shelf.title} hint={shelf.hint} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {shelf.items.map((item, i) => (
          <Tile key={item.id} item={item} hotkey={start + i <= 9 ? start + i : undefined} />
        ))}
      </div>
    </section>
  );
}
