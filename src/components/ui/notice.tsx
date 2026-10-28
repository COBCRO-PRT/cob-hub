import { AlertTriangle, Info, OctagonX } from "lucide-react";
import { cn } from "@/lib/utils";

const TONE = {
  info: { box: "border-accent/25 bg-accent-soft text-mute", icon: "text-accent", Icon: Info, role: undefined },
  warn: { box: "border-warn/35 bg-warn/12 text-warn", icon: "text-warn", Icon: AlertTriangle, role: "status" as const },
  bad: { box: "border-bad/35 bg-bad/12 text-bad", icon: "text-bad", Icon: OctagonX, role: "alert" as const },
};

/** Aviso inline (§7): informação, atenção ou erro, sempre com saída quando há uma. */
export function Notice({
  tone,
  title,
  children,
  action,
  className,
}: {
  tone: "info" | "warn" | "bad";
  title?: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  const t = TONE[tone];
  return (
    <div role={t.role} className={cn("flex flex-wrap items-start gap-3 rounded-md border px-4 py-3", t.box, className)}>
      <t.Icon aria-hidden className={cn("mt-0.5 size-[18px] shrink-0", t.icon)} strokeWidth={1.75} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 type-body">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(tone === "info" && "text-mute", tone !== "info" && "opacity-90")}>{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
