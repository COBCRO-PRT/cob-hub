import { cn } from "@/lib/utils";

export type SurfaceProps<T extends keyof React.JSX.IntrinsicElements = "div"> = {
  level?: 1 | 2;
  /** Hover, afundar ao apertar e foco visível. */
  interactive?: boolean;
  /** Brilho radial de acento. Só o gesto-herói da tela pode ligar (§6). */
  glow?: boolean;
  /** Luz de canto (D2.2): card de topo (KPI, herói, pódio). A lista fica sem. */
  light?: boolean;
  as?: T;
  className?: string;
  children?: React.ReactNode;
} & Omit<React.ComponentPropsWithoutRef<T>, "className" | "children">;

/** Card com relevo (§4.3): borda hairline e brilho de 1px no topo. */
export function Surface<T extends keyof React.JSX.IntrinsicElements = "div">({
  level = 1,
  interactive = false,
  glow = false,
  light = false,
  as,
  className,
  children,
  ...props
}: SurfaceProps<T>) {
  const Tag = (as ?? "div") as React.ElementType;
  return (
    <Tag
      className={cn(
        "rounded-card border border-line shadow-relief",
        level === 1 ? "bg-surface-1" : "bg-surface-2",
        interactive &&
          "cursor-pointer outline-none motion-safe:transition-[background-color,border-color,transform] hover:border-line-strong hover:bg-surface-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-safe:active:scale-[0.985]",
        light && "bg-glow-card",
        glow &&
          "relative overflow-hidden border-accent/35 before:pointer-events-none before:absolute before:inset-0 before:bg-glow-side before:content-['']",
        className,
      )}
      {...props}
    >
      {children}
    </Tag>
  );
}
