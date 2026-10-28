"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Na home, apertar o número do card abre o card. Ninguém digitando, nenhum modificador. */
export function TeclasDaHome({ urls }: { urls: string[] }) {
  const router = useRouter();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target;
      if (t instanceof HTMLElement && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))) return;
      if (document.querySelector('[role="dialog"]')) return;
      const n = Number(e.key);
      const url = Number.isInteger(n) && n >= 1 ? urls[n - 1] : undefined;
      if (!url) return;
      e.preventDefault();
      if (url.startsWith("/")) router.push(url);
      else window.open(url, "_blank", "noopener,noreferrer");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [urls, router]);
  return null;
}
