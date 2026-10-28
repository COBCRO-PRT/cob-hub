import type { Tone } from "@/lib/placar/score";
import { cn } from "@/lib/utils";

export type PillTone = Tone | "accent" | "neutral";

const TONE: Record<PillTone, string> = {
  good: "border-good/35 bg-good/12 text-good",
  warn: "border-warn/35 bg-warn/12 text-warn",
  bad: "border-bad/35 bg-bad/12 text-bad",
  none: "border-line bg-surface-2 text-mute",
  accent: "border-accent/35 bg-accent-soft text-accent-text",
  neutral: "border-line-strong text-mute",
};

/** Chip de estado (§5). */
export function Pill({
  tone = "neutral",
  icon,
  className,
  children,
  ...props
}: {
  tone?: PillTone;
  icon?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
} & Omit<React.HTMLAttributes<HTMLSpanElement>, "className" | "children">) {
  return (
    <span
      className={cn("inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-xs font-semibold [&_svg]:size-3.5 [&_svg]:shrink-0", TONE[tone], className)}
      {...props}
    >
      {icon}
      {children}
    </span>
  );
}
