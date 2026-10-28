import { cn } from "@/lib/utils";

/** Título de seção (§5): título 20/700, dica em mute e um slot à direita. */
export function SectionTitle({
  title,
  hint,
  right,
  id,
  className,
}: {
  title: string;
  hint?: string;
  right?: React.ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-x-6 gap-y-2", className)}>
      <div className="flex min-w-0 flex-col gap-0.5">
        <h2 id={id} className="type-title text-fg">
          {title}
        </h2>
        {hint && <p className="type-body text-mute">{hint}</p>}
      </div>
      {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
    </div>
  );
}
