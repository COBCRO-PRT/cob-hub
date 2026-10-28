import { CONTAINER, Skeleton, Surface } from "@/components/ui";
import { cn } from "@/lib/utils";

/** Esqueleto com a forma da tela (§7): cabeçalho, KPIs e 4 linhas. */
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
        <Surface className="flex flex-wrap gap-8 px-5 py-4">
          <Skeleton shape="metric" />
          <Skeleton shape="metric" />
          <Skeleton shape="metric" />
          <Skeleton shape="metric" />
        </Surface>
        <Surface className="px-5 py-4">
          <Skeleton shape="row" lines={4} />
        </Surface>
      </div>
    </div>
  );
}
