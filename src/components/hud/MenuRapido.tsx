"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowUpRight, CornerDownLeft, Search } from "lucide-react";
import { busca, destinos, type Destino } from "@/lib/destinos";
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

export function pushRecent(id: string) {
  try {
    const next = [id, ...readRecent().filter((x) => x !== id)].slice(0, RECENT_MAX);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
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
      className="fixed inset-0 z-[70] flex items-start justify-center bg-black/65 px-3 pt-[10vh] backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={onClose}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Ir para"
        className="flex max-h-[72vh] w-full max-w-[600px] flex-col overflow-hidden rounded-2xl border border-white/12 bg-[#0c0e11] shadow-2xl"
        initial={reduce ? false : { y: -12, scale: 0.98 }}
        animate={{ y: 0, scale: 1 }}
        exit={reduce ? undefined : { y: -8, opacity: 0 }}
        transition={{ type: "spring", stiffness: 420, damping: 34 }}
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKey}
      >
        <label className="flex items-center gap-3 border-b border-white/8 px-4">
          <Search aria-hidden className="size-[18px] shrink-0 text-[#00e5ff]" />
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
            className="h-14 w-full bg-transparent text-[16px] text-white outline-none placeholder:text-zinc-500"
          />
          <kbd className="hidden rounded border border-white/15 px-1.5 py-0.5 font-mono text-[11px] text-zinc-400 sm:block">esc</kbd>
        </label>

        <ul id="menu-rapido-lista" ref={listRef} role="listbox" className="flex-1 overflow-y-auto p-2">
          {rows.length === 0 && <li className="px-3 py-8 text-center text-[14px] text-zinc-500">Nenhum lugar com esse nome.</li>}
          {rows.map((r, i) => (
            <li key={`${r.section}_${r.d.id}`} role="presentation">
              {(i === 0 || rows[i - 1].section !== r.section) && (
                <p className="px-3 pb-1.5 pt-3 font-mono text-[10.5px] uppercase tracking-[0.14em] text-zinc-500">{r.section}</p>
              )}
              <button
                id={`mr-${r.d.id}`}
                type="button"
                role="option"
                aria-selected={i === active}
                data-i={i}
                onMouseMove={() => setActive(i)}
                onClick={() => go(r.d)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${i === active ? "bg-white/[0.07]" : ""}`}
              >
                <DestinoIcon d={r.d} active={i === active} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="flex items-center gap-1.5 text-[14.5px] font-semibold text-white">
                    {r.d.name}
                    {r.d.external && <ArrowUpRight aria-label="abre em outra aba" className="size-3.5 text-zinc-500" />}
                  </span>
                  <span className="truncate text-[12.5px] text-zinc-500">{r.d.what}</span>
                </span>
                {i === active && <CornerDownLeft aria-hidden className="size-4 shrink-0 text-[#00e5ff]" />}
              </button>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-4 border-t border-white/8 px-4 py-2.5 font-mono text-[11px] text-zinc-500 sm:flex">
          <span>
            <kbd className="text-zinc-300">↑ ↓</kbd> escolher
          </span>
          <span>
            <kbd className="text-zinc-300">enter</kbd> abrir
          </span>
          <span>
            <kbd className="text-zinc-300">esc</kbd> fechar
          </span>
          <span className="ml-auto">
            <kbd className="text-zinc-300">/</kbd> ou <kbd className="text-zinc-300">⌘K</kbd> abre de qualquer tela
          </span>
        </div>
      </motion.div>
    </motion.div>
  );
}
