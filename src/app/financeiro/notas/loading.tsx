import { CONTAINER, Skeleton, Surface } from "@/components/ui";
import { cn } from "@/lib/utils";

/** Esqueleto com a forma da tela (D2.5): cabeçalho, três KPIs e a tabela de linhas de 48px. */
export default function Loading() {
  return (
    <div className="min-h-screen bg-bg">
      <div className={cn(CONTAINER, "flex flex-col gap-7 pb-44")}>
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div className="flex flex-col gap-3">
            <Skeleton className="w-32" />
            <Skeleton shape="metric" className="w-72" />
          </div>
          <Skeleton shape="metric" className="w-56" />
        </div>
        <div className="grid grid-cols-12 gap-4">
          {[0, 1, 2].map((i) => (
            <Surface key={i} light className="col-span-12 flex flex-col gap-4 p-5 md:col-span-4">
              <Skeleton className="w-20" />
              <Skeleton shape="metric" />
            </Surface>
          ))}
        </div>
        <Surface className="flex flex-col gap-0 px-5 py-2">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className={cn("flex h-12 items-center gap-6", i % 2 === 1 && "-mx-5 bg-surface-2 px-5")}>
              <Skeleton className="w-40" />
              <Skeleton className="w-64 max-sm:hidden" />
              <Skeleton className="ml-auto w-20" />
            </div>
          ))}
        </Surface>
      </div>
    </div>
  );
}
