"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { LogIn, Search } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button, Kbd, spring } from "@/components/ui";
import { ABAS, abaAtual, destinos } from "@/lib/destinos";
import { cn } from "@/lib/utils";
import { HUD_ICON } from "./DestinoIcon";
import { MenuRapido, pushRecent } from "./MenuRapido";
import { PlayerCard } from "./PlayerCard";
import { usePlayer } from "./usePlayer";

export type HudPessoa = { name: string; role: "admin" | "time" } | null;

/** Telas de login ficam sem barra: ali ainda não há para onde ir. */
const SEM_BARRA = ["/entrar", "/placar/entrar", "/financeiro/entrar"];

const typing = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));

/**
 * Barra do jogo (§6.1): mapa do hub (abas), menu rápido (⌘K) e cartão do jogador.
 * No celular as abas descem para o rodapé. Regras em docs/navegacao.md.
 */
export function Hud({ pessoa }: { pessoa: HudPessoa }) {
  const pathname = usePathname();
  const [menu, setMenu] = useState(false);
  const admin = pessoa?.role === "admin";
  const player = usePlayer(Boolean(pessoa));
  const hidden = SEM_BARRA.some((p) => pathname.startsWith(p));
  const aba = abaAtual(pathname);
  const abas = ABAS.filter((a) => !a.admin || admin);
  const missions = player.data ? (admin ? player.data.missions.team : player.data.missions.mine) : 0;

  // ⌘K / Ctrl+K de qualquer lugar; "/" quando ninguém está digitando.
  useEffect(() => {
    if (hidden) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setMenu((m) => !m);
      } else if (e.key === "/" && !e.metaKey && !e.ctrlKey && !typing(e.target)) {
        e.preventDefault();
        setMenu(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hidden]);

  // Tela visitada entra em "Últimos lugares" do menu rápido.
  useEffect(() => {
    const d = destinos(true).find((x) => !x.external && x.href === pathname);
    if (d) pushRecent(d.id);
  }, [pathname]);

  if (hidden) return null;

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-line bg-surface-1/92 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-[1280px] items-center gap-3 px-4 sm:gap-5 sm:px-6 lg:px-10">
          <Link href="/" aria-label="Início" className="shrink-0 rounded-xs outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
            <Logo className="h-[16px]" />
          </Link>

          <nav aria-label="Mapa do hub" className="hidden h-full items-stretch gap-1 sm:flex">
            {abas.map((a) => {
              const Icon = HUD_ICON[a.icon];
              const on = aba === a.id;
              return (
                <Link
                  key={a.id}
                  href={a.href}
                  aria-current={on ? "page" : undefined}
                  className={cn(
                    "relative flex items-center gap-2 px-3 type-body font-medium outline-none motion-safe:transition-colors focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-accent",
                    on ? "text-fg" : "text-mute hover:text-fg",
                  )}
                >
                  <Icon aria-hidden className={cn("size-4", on && "text-accent")} strokeWidth={1.75} />
                  {a.label}
                  {a.id === "rodada" && missions > 0 && <Badge n={missions} />}
                  {on && <motion.span layoutId="aba-acesa" transition={spring} className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-accent" />}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMenu(true)}
              className="flex h-9 items-center gap-2 rounded-full border border-line bg-surface-1 px-3 type-body text-mute shadow-relief outline-none motion-safe:transition-colors hover:border-line-strong hover:bg-surface-2 hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:min-w-[200px]"
              aria-label="Ir para… (atalho ⌘K)"
            >
              <Search aria-hidden className="size-4 text-accent" strokeWidth={1.75} />
              <span className="hidden sm:inline">Ir para…</span>
              <Kbd className="ml-auto hidden sm:inline-flex">⌘K</Kbd>
            </button>
            {pessoa ? (
              <PlayerCard pessoa={pessoa} player={player} />
            ) : (
              <Button variant="primary" size="sm" href="/placar/entrar" icon={<LogIn aria-hidden strokeWidth={1.75} />}>
                Entrar
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Celular: o mapa vai para o rodapé, ao alcance do polegar. */}
      <nav aria-label="Mapa do hub" className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-surface-1/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md sm:hidden">
        {abas.map((a) => {
          const Icon = HUD_ICON[a.icon];
          const on = aba === a.id;
          return (
            <Link
              key={a.id}
              href={a.href}
              aria-current={on ? "page" : undefined}
              className={cn("relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 py-2 type-caption outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent", on ? "text-fg" : "text-dim")}
            >
              <span className="relative">
                <Icon aria-hidden className={cn("size-5", on && "text-accent")} strokeWidth={1.75} />
                {a.id === "rodada" && missions > 0 && (
                  <span className="absolute -top-1.5 -right-2.5">
                    <Badge n={missions} />
                  </span>
                )}
              </span>
              {a.label}
              {on && <motion.span layoutId="aba-acesa-mobile" transition={spring} className="absolute inset-x-6 top-0 h-0.5 rounded-full bg-accent" />}
            </Link>
          );
        })}
      </nav>

      <AnimatePresence>{menu && <MenuRapido admin={admin} onClose={() => setMenu(false)} />}</AnimatePresence>
    </>
  );
}

function Badge({ n }: { n: number }) {
  return (
    <span
      aria-label={`${n} ${n === 1 ? "missão aberta" : "missões abertas"}`}
      className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-xs leading-none font-bold tabular-nums text-accent-fg"
    >
      {n > 99 ? "99+" : n}
    </span>
  );
}

/** No celular, reserva o espaço da barra do rodapé no fim da página. */
export function HudSpacer() {
  const pathname = usePathname();
  if (SEM_BARRA.some((p) => pathname.startsWith(p))) return null;
  return <div aria-hidden className="h-[72px] shrink-0 sm:hidden" />;
}
