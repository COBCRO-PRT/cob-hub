"use client";

import Link from "next/link";
import { motion, type HTMLMotionProps } from "motion/react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "ghost" | "soft" | "danger" | "link";
export type ButtonSize = "sm" | "md" | "lg";

const BASE =
  "group relative inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold outline-none motion-safe:transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-50 aria-busy:pointer-events-none";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-fg hover:bg-[color-mix(in_srgb,var(--color-accent),white_12%)]",
  ghost: "border border-line text-mute hover:border-line-strong hover:bg-surface-2 hover:text-fg",
  soft: "bg-surface-2 text-fg shadow-relief hover:bg-surface-3",
  danger: "border border-bad/35 text-bad hover:bg-bad/12",
  link: "rounded-sm px-0 font-medium text-accent-text underline-offset-4 hover:underline",
};

/** Alvo de 44px no celular (§8); no desktop o `sm` tem 32px. */
const SIZE: Record<ButtonSize, string> = {
  sm: "h-8 px-3.5 text-xs max-sm:h-11 max-sm:px-4 max-sm:text-sm",
  md: "h-9 px-4 text-sm max-sm:h-11",
  lg: "h-11 px-6 text-sm",
};

const ICON: Record<ButtonSize, string> = { sm: "[&_svg]:size-4", md: "[&_svg]:size-4", lg: "[&_svg]:size-[18px]" };

type Native = Omit<HTMLMotionProps<"button">, "children" | "ref">;

export type ButtonProps = Native & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Rótulo vira spinner, largura fica. */
  pending?: boolean;
  /** Elemento (`<Plus />`), não componente, para servir de tela de servidor. */
  icon?: React.ReactNode;
  /** No `primary`, o ícone final mora num círculo próprio: a assinatura da Arena. */
  iconEnd?: React.ReactNode;
  /** Com `href` vira link (Next Link). */
  href?: string;
  children?: React.ReactNode;
};

const MotionLink = motion.create(Link);

export function Button({
  variant = "ghost",
  size = "md",
  pending = false,
  icon,
  iconEnd,
  href,
  className,
  children,
  disabled,
  type,
  ...props
}: ButtonProps) {
  const iconOnly = !children && Boolean(icon || iconEnd);
  const classes = cn(
    BASE,
    VARIANT[variant],
    variant !== "link" && SIZE[size],
    iconOnly && "aspect-square px-0",
    iconEnd && variant === "primary" && !iconOnly && (size === "lg" ? "pr-2.5" : "pr-1.5"),
    className,
  );
  const body = (
    <>
      <span className={cn("contents [&_svg]:shrink-0", ICON[size], pending && "invisible")} aria-hidden={pending || undefined}>
        {icon}
        {children}
        {iconEnd &&
          (variant === "primary" ? (
            <span className="flex size-[22px] items-center justify-center rounded-full bg-accent-fg/18 motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5 [&_svg]:size-3.5">
              {iconEnd}
            </span>
          ) : (
            iconEnd
          ))}
      </span>
      {pending && (
        <span className="absolute inset-0 flex items-center justify-center" aria-hidden>
          <Loader2 className="size-4 motion-safe:animate-spin" strokeWidth={2} />
        </span>
      )}
    </>
  );
  const tap = { whileTap: { scale: 0.98 } };
  if (href) {
    return (
      <MotionLink href={href} className={classes} aria-busy={pending || undefined} {...tap} {...(props as object)}>
        {body}
      </MotionLink>
    );
  }
  return (
    <motion.button
      type={type ?? "button"}
      className={classes}
      disabled={disabled}
      aria-busy={pending || undefined}
      {...tap}
      {...props}
    >
      {body}
    </motion.button>
  );
}
