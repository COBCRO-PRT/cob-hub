import { cn } from "@/lib/utils";

/** Eyebrow e cabeçalho de coluna: mono, caixa alta, 11px. Substitui as 25 variações antigas. */
export function Label({
  tone = "dim",
  as: Tag = "span",
  className,
  children,
  ...props
}: {
  tone?: "dim" | "accent";
  as?: "span" | "p" | "th" | "div";
  className?: string;
  children: React.ReactNode;
} & Omit<React.HTMLAttributes<HTMLElement>, "className" | "children">) {
  return (
    <Tag className={cn("type-label", tone === "accent" ? "text-accent" : "text-dim", className)} {...props}>
      {children}
    </Tag>
  );
}
