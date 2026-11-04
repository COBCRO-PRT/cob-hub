"use client";

import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * O único modal do hub (§5). Centrado no desktop; `sm` vira folha inferior no celular.
 * Foco preso, rolagem travada e Esc vêm do base-ui. Entrada em CSS com a curva quint
 * (o base-ui controla a montagem, então a mola do motion não entra aqui).
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  size = "md",
  children,
  footer,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  size?: "sm" | "md";
  children?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-60 bg-bg/80 backdrop-blur-sm motion-safe:duration-200 motion-safe:data-open:animate-in motion-safe:data-open:fade-in-0 motion-safe:data-closed:animate-out motion-safe:data-closed:fade-out-0" />
        <Dialog.Popup
          className={cn(
            "fixed z-60 flex max-h-[calc(100dvh-24px)] w-full flex-col overflow-hidden border border-line bg-surface-1 shadow-float outline-none",
            "inset-x-0 bottom-0 rounded-t-panel pb-[env(safe-area-inset-bottom)]",
            "sm:inset-auto sm:top-1/2 sm:left-1/2 sm:max-h-[calc(100dvh-64px)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-panel sm:pb-0",
            size === "sm" ? "sm:max-w-[28rem]" : "sm:max-w-[36rem]",
            "motion-safe:duration-200 motion-safe:ease-(--ease-out-quint) motion-safe:data-open:animate-in motion-safe:data-open:fade-in-0 motion-safe:data-open:slide-in-from-bottom-4 motion-safe:data-closed:animate-out motion-safe:data-closed:fade-out-0 motion-safe:data-closed:slide-out-to-bottom-2",
            className,
          )}
        >
          <div className="flex items-start gap-4 px-5 pt-5 pb-3 sm:px-6 sm:pt-6">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <Dialog.Title className="type-title text-fg">{title}</Dialog.Title>
              {description && <Dialog.Description className="type-body text-mute">{description}</Dialog.Description>}
            </div>
            <Dialog.Close
              aria-label="Fechar"
              className="-mt-1 -mr-1 flex size-9 shrink-0 items-center justify-center rounded-full text-mute outline-none motion-safe:transition-colors hover:bg-surface-2 hover:text-fg focus-visible:outline-2 focus-visible:outline-accent"
            >
              <X aria-hidden className="size-[18px]" strokeWidth={1.75} />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 sm:px-6">{children}</div>
          {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-4 sm:px-6">{footer}</div>}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
