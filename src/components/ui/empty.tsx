import { cn } from "@/lib/utils";

/** Vazio com verbo (§7): diz o que vai aparecer e como começar. */
export function Empty({ title, text, action, className }: { title: string; text?: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center gap-3 rounded-card border border-dashed border-line-strong px-6 py-10 text-center", className)}>
      <p className="type-subtitle text-fg">{title}</p>
      {text && <p className="type-body max-w-md text-mute">{text}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
