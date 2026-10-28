import { cn } from "@/lib/utils";

/** Tecla de atalho. Um estilo só (§5). */
export function Kbd({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-xs border border-line-strong bg-surface-2 px-1 font-mono text-xs leading-none text-mute",
        className,
      )}
    >
      {children}
    </kbd>
  );
}
