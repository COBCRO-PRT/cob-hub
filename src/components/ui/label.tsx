import { cn } from "@/lib/utils";

/** Eyebrow e cabeçalho de coluna: caixa alta, 11px, sem mono (D2.2). Substitui as 25 variações antigas. */
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
