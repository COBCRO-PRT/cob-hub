"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowUpRight, CornerDownLeft, Search } from "lucide-react";
import { Kbd, Label, spring } from "@/components/ui";
import { busca, destinos, type Destino } from "@/lib/destinos";
import { cn } from "@/lib/utils";
import { DestinoIcon } from "./DestinoIcon";

const RECENT_KEY = "cob-hub-recentes";
const RECENT_MAX = 4;

export function readRecent(): string[] {
  try {
    const v = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

const recentListeners = new Set<() => void>();
/** Assinatura dos recentes (sidebar): a string crua do localStorage é o snapshot estável. */
export function subscribeRecent(l: () => void) {
  recentListeners.add(l);
  return () => {
    recentListeners.delete(l);
  };
}
export function readRecentRaw(): string {
  try {
    return window.localStorage.getItem(RECENT_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

export function pushRecent(id: string) {
  try {
    const next = [id, ...readRecent().filter((x) => x !== id)].slice(0, RECENT_MAX);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    recentListeners.forEach((l) => l());
  } catch {
    // navegação privada: segue sem lembrar
  }
}

type Row = { d: Destino; section: string };

/** Menu rápido (⌘K): achar qualquer lugar do hub ou ferramenta digitando. */
export function MenuRapido({ admin, onClose }: { admin: boolean; onClose: () => void }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const [recent] = useState(readRecent);
  const input = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const all = useMemo(() => destinos(admin), [admin]);
  const rows: Row[] = useMemo(() => {
    if (q.trim()) return busca(all, q).map((d) => ({ d, section: "Resultados" }));
    const byId = new Map(all.map((d) => [d.id, d]));
    const recents = recent.map((id) => byId.get(id)).filter((d): d is Destino => Boolean(d));
    return [
      ...recents.map((d) => ({ d, section: "Últimos lugares" })),
      ...all.filter((d) => d.group === "hub").map((d) => ({ d, section: "No hub" })),
      ...all.filter((d) => d.group === "ferramentas").map((d) => ({ d, section: "Ferramentas" })),
    ];
  }, [all, q, recent]);

  useEffect(() => {
    input.current?.focus();
  }, []);

  useEffect(() => {
    listRef.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function go(d: Destino) {
    pushRecent(d.id);
    onClose();
    if (d.external) window.open(d.href, "_blank", "noopener,noreferrer");
    else router.push(d.href);
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (rows.length ? (i + 1) % rows.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (rows.length ? (i - 1 + rows.length) % rows.length : 0));
    } else if (e.key === "Enter" && rows[active]) {
      e.preventDefault();
      go(rows[active].d);
    }
  }

  return (
    <motion.div
      className="fixed inset-0 z-80 flex items-start justify-center bg-bg/80 px-3 pt-[10vh] backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={onClose}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Ir para"
        className="flex max-h-[72vh] w-full max-w-[38rem] flex-col overflow-hidden rounded-panel border border-line bg-surface-1 shadow-float"
        initial={reduce ? false : { y: 16, scale: 0.98, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        exit={reduce ? undefined : { y: 8, opacity: 0 }}
        transition={spring}
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKey}
      >
        <label className="flex items-center gap-3 border-b border-line px-4">
          <Search aria-hidden className="size-[18px] shrink-0 text-dim" strokeWidth={1.75} />
          <input
            ref={input}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            placeholder="Para onde? Digite placar, notas, missões, ClickUp…"
            aria-label="Buscar um lugar do hub"
            aria-controls="menu-rapido-lista"
            aria-activedescendant={rows[active] ? `mr-${rows[active].d.id}` : undefined}
            className="h-14 w-full bg-transparent text-base text-fg outline-none placeholder:text-dim"
          />
          <Kbd className="hidden sm:inline-flex">esc</Kbd>
        </label>

        <ul id="menu-rapido-lista" ref={listRef} role="listbox" className="flex-1 overflow-y-auto p-2">
          {rows.length === 0 && <li className="px-3 py-8 text-center type-body text-dim">Nenhum lugar com esse nome.</li>}
          {rows.map((r, i) => (
            <li key={`${r.section}_${r.d.id}`} role="presentation">
              {(i === 0 || rows[i - 1].section !== r.section) && (
                <Label as="p" className="px-3 pt-3 pb-1.5">
                  {r.section}
                </Label>
              )}
              <button
                id={`mr-${r.d.id}`}
                type="button"
                role="option"
                aria-selected={i === active}
                data-i={i}
                onMouseMove={() => setActive(i)}
                onClick={() => go(r.d)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left outline-none motion-safe:transition-colors",
                  i === active ? "bg-surface-2 text-fg" : "text-mute",
                )}
              >
                <DestinoIcon d={r.d} active={i === active} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="flex items-center gap-1.5 type-body font-semibold text-fg">
                    {r.d.name}
                    {r.d.external && <ArrowUpRight aria-label="abre em outra aba" className="size-3.5 text-dim" strokeWidth={1.75} />}
                  </span>
                  <span className="truncate type-caption text-dim">{r.d.what}</span>
                </span>
                {i === active && <CornerDownLeft aria-hidden className="size-4 shrink-0 text-mute" strokeWidth={1.75} />}
              </button>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-4 border-t border-line px-4 py-2.5 type-caption text-dim sm:flex">
          <span className="inline-flex items-center gap-1.5">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> escolher
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Kbd>enter</Kbd> abrir
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Kbd>esc</Kbd> fechar
          </span>
          <span className="ml-auto inline-flex items-center gap-1.5">
            <Kbd>/</Kbd> ou <Kbd>⌘K</Kbd> abre de qualquer tela
          </span>
        </div>
      </motion.div>
    </motion.div>
  );
}
