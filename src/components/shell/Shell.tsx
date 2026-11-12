"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "motion/react";
import { LogIn, Search } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button, Kbd, Label, spring } from "@/components/ui";
import { HUD_ICON } from "@/components/hud/DestinoIcon";
import { MenuRapido, pushRecent, readRecentRaw, subscribeRecent } from "@/components/hud/MenuRapido";
import { PlayerCard } from "@/components/hud/PlayerCard";
import { usePlayer } from "@/components/hud/usePlayer";
import { ABAS, abaAtual, destinos, type Destino } from "@/lib/destinos";
import { cn } from "@/lib/utils";

export type HudPessoa = { name: string; role: "admin" | "time" } | null;

/** Telas de login ficam sem casca: ali ainda não há para onde ir. */
// /meta é a página do cliente (docs/placar-pedido-cliente.md): ele nunca vê o hub.
const SEM_CASCA = ["/entrar", "/placar/entrar", "/financeiro/entrar", "/meta/"];

const typing = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));

const subscribeNoop = () => () => {};
const useMounted = () => useSyncExternalStore(subscribeNoop, () => true, () => false);

/**
 * A casca do hub (D2.3): sidebar fixa no desktop, trilho estreito em tablet, cabeçalho curto e
 * barra inferior no celular. O menu rápido (⌘K) e o cartão do jogador moram aqui.
 * Regras de navegação em docs/navegacao.md.
 */
export function Shell({ pessoa, children }: { pessoa: HudPessoa; children: React.ReactNode }) {
  const pathname = usePathname();
  const mounted = useMounted();
  const [menu, setMenu] = useState(false);
  const admin = pessoa?.role === "admin";
  const player = usePlayer(Boolean(pessoa));
  const bare = SEM_CASCA.some((p) => pathname.startsWith(p));
  const aba = abaAtual(pathname);
  const abas = ABAS.filter((a) => !a.admin || admin);
  const missions = player.data ? (admin ? player.data.missions.team : player.data.missions.mine) : 0;

  // ⌘K / Ctrl+K de qualquer lugar; "/" quando ninguém está digitando.
  useEffect(() => {
    if (bare) return;
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
  }, [bare]);

  // Tela visitada entra em "Últimos lugares" (menu rápido e grupo Atalhos da sidebar).
  useEffect(() => {
    const d = destinos(admin).find((x) => !x.external && x.href === pathname);
    if (d) pushRecent(d.id);
  }, [pathname, admin]);
  const recentRaw = useSyncExternalStore(subscribeRecent, readRecentRaw, () => "[]");
  const recent = useMemo(() => {
    let ids: string[] = [];
    try {
      const v = JSON.parse(recentRaw);
      if (Array.isArray(v)) ids = v.filter((x): x is string => typeof x === "string");
    } catch {
      ids = [];
    }
    const byId = new Map(destinos(admin).map((x) => [x.id, x]));
    const hubIds = new Set(ABAS.map((a) => a.id));
    return ids.map((id) => byId.get(id)).filter((x): x is Destino => Boolean(x) && !hubIds.has(x!.id)).slice(0, 4);
  }, [recentRaw, admin]);

  if (bare) return <>{children}</>;

  const badge = missions > 0 ? <Badge n={missions} /> : null;

  return (
    <>
      {/* Desktop e tablet: sidebar fixa à esquerda. */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[72px] flex-col border-r border-line bg-surface-1 md:flex lg:w-[248px]">
        <div className="flex h-14 items-center gap-2 px-4 lg:px-5">
          <Link href="/" aria-label="Início" className="shrink-0 rounded-xs outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
            <Logo className="h-[14px]" />
          </Link>
          <span className="hidden type-caption text-dim lg:inline">Hub</span>
        </div>

        <div className="px-3 pb-2 lg:px-3">
          <button
            type="button"
            onClick={() => setMenu(true)}
            aria-label="Ir para… (atalho ⌘K)"
            className="flex h-9 w-full items-center gap-2 rounded-md border border-line bg-bg px-2.5 type-body text-dim outline-none motion-safe:transition-colors hover:border-line-strong hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <Search aria-hidden className="size-4 shrink-0" strokeWidth={1.75} />
            <span className="hidden flex-1 text-left lg:inline">Ir para…</span>
            <Kbd className="hidden lg:inline-flex">⌘K</Kbd>
          </button>
        </div>

        <nav aria-label="Mapa do hub" className="flex flex-col gap-0.5 px-3 pt-2">
          <Label as="p" className="hidden px-2 pb-2 lg:block">Mapa</Label>
          {abas.map((a) => {
            const Icon = HUD_ICON[a.icon];
            const on = aba === a.id;
            return (
              <Link
                key={a.id}
                href={a.href}
                title={a.label}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "relative flex h-10 items-center gap-3 rounded-md px-2.5 type-body font-medium outline-none motion-safe:transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
                  on ? "bg-surface-2 text-fg" : "text-mute hover:bg-surface-2/60 hover:text-fg",
                )}
              >
                {on && <motion.span layoutId="aba-acesa" transition={spring} className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-fg" />}
                <Icon aria-hidden className="size-[18px] shrink-0" strokeWidth={1.75} />
                <span className="hidden flex-1 truncate lg:inline">{a.label}</span>
                {a.id === "rodada" && badge && <span className="absolute top-1 right-1 lg:static">{badge}</span>}
              </Link>
            );
          })}
        </nav>

        {recent.length > 0 && (
          <nav aria-label="Atalhos recentes" className="hidden flex-col gap-0.5 px-3 pt-6 lg:flex">
            <Label as="p" className="px-2 pb-2">Atalhos</Label>
            {recent.map((d) => (
              <a
                key={d.id}
                href={d.href}
                target={d.external ? "_blank" : undefined}
                rel={d.external ? "noopener noreferrer" : undefined}
                className="flex h-9 items-center gap-3 rounded-md px-2.5 type-body text-mute outline-none motion-safe:transition-colors hover:bg-surface-2/60 hover:text-fg focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
              >
                <span aria-hidden className="flex size-[18px] shrink-0 items-center justify-center rounded-xs bg-surface-2 text-xs font-bold text-dim">
                  {d.mark ?? d.name.charAt(0)}
                </span>
                <span className="truncate">{d.name}</span>
              </a>
            ))}
          </nav>
        )}

        <div className="mt-auto p-3">
          {pessoa ? (
            <>
              <div className="hidden lg:block">
                <PlayerCard pessoa={pessoa} player={player} placement="up" wide />
              </div>
              <div className="flex justify-center lg:hidden">
                <PlayerCard pessoa={pessoa} player={player} placement="up" />
              </div>
            </>
          ) : (
            <Button variant="primary" size="sm" href="/placar/entrar" icon={<LogIn aria-hidden strokeWidth={1.75} />} className="w-full">
              <span className="hidden lg:inline">Entrar</span>
            </Button>
          )}
        </div>
      </aside>

      {/* Celular: cabeçalho curto em cima, mapa no rodapé. */}
      <header className="sticky top-0 z-40 flex h-13 items-center gap-3 border-b border-line bg-surface-1/92 px-4 backdrop-blur-md md:hidden">
        <Link href="/" aria-label="Início" className="shrink-0 rounded-xs outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
          <Logo className="h-[14px]" />
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMenu(true)}
            aria-label="Ir para…"
            className="flex size-9 items-center justify-center rounded-full border border-line bg-surface-1 text-mute outline-none hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <Search aria-hidden className="size-4" strokeWidth={1.75} />
          </button>
          {pessoa ? (
            <PlayerCard pessoa={pessoa} player={player} />
          ) : (
            <Button variant="primary" size="sm" href="/placar/entrar" icon={<LogIn aria-hidden strokeWidth={1.75} />}>
              Entrar
            </Button>
          )}
        </div>
      </header>

      <div className="md:pl-[72px] lg:pl-[248px]">{children}</div>

      <nav aria-label="Mapa do hub" className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-surface-1/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden">
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
                <Icon aria-hidden className="size-5" strokeWidth={1.75} />
                {a.id === "rodada" && badge && <span className="absolute -top-1.5 -right-2.5">{badge}</span>}
              </span>
              {a.label}
              {on && <motion.span layoutId="aba-acesa-mobile" transition={spring} className="absolute inset-x-6 top-0 h-0.5 rounded-full bg-fg" />}
            </Link>
          );
        })}
      </nav>
      {/* Reserva o espaço da barra inferior no fim da página. */}
      <div aria-hidden className="h-[72px] shrink-0 md:hidden" />

      <AnimatePresence>{mounted && menu && <MenuRapido admin={admin} onClose={() => setMenu(false)} />}</AnimatePresence>
    </>
  );
}

function Badge({ n }: { n: number }) {
  return (
    <span
      aria-label={`${n} ${n === 1 ? "missão aberta" : "missões abertas"}`}
      className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-surface-3 px-1 text-xs leading-none font-semibold tabular-nums text-fg ring-1 ring-line-strong"
    >
      {n > 99 ? "99+" : n}
    </span>
  );
}
