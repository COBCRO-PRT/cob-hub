import { cn } from "@/lib/utils";

const SHAPE = {
  text: "h-3.5 w-full rounded-xs",
  metric: "h-10 w-24 rounded-sm",
  row: "h-16 w-full rounded-card",
  ring: "size-10 rounded-full",
};

/** Esqueleto com a forma do conteúdo (§7). `lines` repete a forma. */
export function Skeleton({ shape = "text", lines = 1, className }: { shape?: keyof typeof SHAPE; lines?: number; className?: string }) {
  return (
    <div aria-hidden className={cn("flex flex-col gap-2", className)}>
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className={cn("bg-surface-2 motion-safe:animate-pulse", SHAPE[shape], shape === "text" && i === lines - 1 && lines > 1 && "w-2/3")} />
      ))}
    </div>
  );
}
