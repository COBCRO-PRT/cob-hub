import { createElement } from "react";
import { cn } from "@/lib/utils";

type Control = "input" | "select" | "textarea";

export type FieldProps = {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  as?: Control;
  className?: string;
  /** Opções do `select`. */
  children?: React.ReactNode;
} & Omit<React.AllHTMLAttributes<HTMLElement>, "label" | "as" | "children" | "className" | "id">;

/** 16px no celular para o iPhone não dar zoom ao focar (§5). */
const CONTROL =
  "w-full rounded-sm border border-line bg-surface-2 px-3 py-2 text-base text-fg shadow-relief outline-none motion-safe:transition-colors placeholder:text-dim hover:border-line-strong focus:border-accent focus:ring-2 focus:ring-accent-soft disabled:opacity-50 sm:text-sm aria-invalid:border-bad aria-invalid:focus:ring-bad/12";

export function Field({ id, label, hint, error, as = "input", className, children, ...props }: FieldProps) {
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
  const control = createElement(
    as,
    {
      id,
      className: cn(CONTROL, as === "textarea" && "min-h-24 resize-y", as === "select" && "appearance-none pr-9"),
      "aria-invalid": error ? true : undefined,
      "aria-describedby": describedBy,
      ...props,
    },
    as === "select" ? children : undefined,
  );
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="type-label text-dim">
        {label}
      </label>
      {as === "select" ? (
        <div className="relative">
          {control}
          <svg aria-hidden viewBox="0 0 16 16" className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-dim" fill="none" stroke="currentColor" strokeWidth={1.75}>
            <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      ) : (
        control
      )}
      {hint && !error && (
        <p id={`${id}-hint`} className="type-caption text-dim">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="type-caption text-bad">
          {error}
        </p>
      )}
    </div>
  );
}
