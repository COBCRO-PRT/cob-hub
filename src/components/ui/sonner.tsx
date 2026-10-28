"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";
import { CircleCheck, Info, Loader2, OctagonX, TriangleAlert } from "lucide-react";

/** O único toast do hub (§5): embaixo no centro, acima da barra inferior do celular, pelos tokens. */
export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="dark"
      position="bottom-center"
      offset={24}
      mobileOffset={{ bottom: 80 }}
      duration={3000}
      icons={{
        success: <CircleCheck className="size-4 text-good" strokeWidth={1.75} />,
        info: <Info className="size-4 text-accent" strokeWidth={1.75} />,
        warning: <TriangleAlert className="size-4 text-warn" strokeWidth={1.75} />,
        error: <OctagonX className="size-4 text-bad" strokeWidth={1.75} />,
        loading: <Loader2 className="size-4 motion-safe:animate-spin" strokeWidth={1.75} />,
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast: "flex w-full items-center gap-3 rounded-md border border-line bg-surface-2 px-4 py-3 shadow-float type-body text-fg",
          title: "font-semibold",
          description: "text-mute",
          icon: "shrink-0",
        },
      }}
      {...props}
    />
  );
}
