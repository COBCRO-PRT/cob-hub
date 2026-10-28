"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronDown, Crown, Gauge, LogIn, LogOut, Search, Target } from "lucide-react";
import { Logo } from "@/components/Logo";
import { ABAS, abaAtual, destinos } from "@/lib/destinos";
import { LEVELS } from "@/lib/placar/rodada-rules";
import type { Jogador } from "@/lib/placar/jogador";
import { HUD_ICON } from "./DestinoIcon";
import { MenuRapido, pushRecent } from "./MenuRapido";
import { usePlayer } from "./usePlayer";

export type HudPessoa = { name: string; role: "admin" | "time" } | null;

/** Telas de login ficam sem barra: ali ainda não há para onde ir. */
const SEM_BARRA = ["/entrar", "/placar/entrar", "/financeiro/entrar"];

const typing = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));

/**
 * Barra do jogo: mapa do hub (abas), menu rápido (⌘K) e cartão do jogador.
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
      <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#07080a]/92 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-[1280px] items-center gap-3 px-4 sm:gap-5 sm:px-6 lg:px-10">
          <Link href="/" aria-label="Início" className="shrink-0 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff]">
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
                  className={`relative flex items-center gap-2 px-3 text-[13.5px] font-medium transition-colors ${on ? "text-white" : "text-zinc-400 hover:text-white"}`}
                >
                  <Icon aria-hidden className={`size-4 ${on ? "text-[#00e5ff]" : ""}`} />
                  {a.label}
                  {a.id === "rodada" && missions > 0 && <Badge n={missions} />}
                  {on && <motion.span layoutId="aba-acesa" className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[#00e5ff]" />}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMenu(true)}
              className="flex h-9 items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 text-[13px] text-zinc-300 transition hover:border-[#00e5ff]/60 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff] sm:min-w-[200px]"
              aria-label="Ir para… (atalho ⌘K)"
            >
              <Search aria-hidden className="size-4 text-[#00e5ff]" />
              <span className="hidden sm:inline">Ir para…</span>
              <kbd className="ml-auto hidden rounded border border-white/15 px-1.5 font-mono text-[11px] text-zinc-500 sm:block">⌘K</kbd>
            </button>
            {pessoa ? (
              <PlayerChip pessoa={pessoa} data={player.data} />
            ) : (
              <Link
                href="/placar/entrar"
                className="flex h-9 items-center gap-1.5 rounded-full bg-[#00e5ff] px-4 text-[13px] font-semibold text-[#04141a] transition hover:bg-[#00b4d8]"
              >
                <LogIn aria-hidden className="size-4" /> Entrar
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Celular: o mapa vai para o rodapé, ao alcance do polegar. */}
      <nav
        aria-label="Mapa do hub"
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-white/10 bg-[#0c0e11]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md sm:hidden"
      >
        {abas.map((a) => {
          const Icon = HUD_ICON[a.icon];
          const on = aba === a.id;
          return (
            <Link
              key={a.id}
              href={a.href}
              aria-current={on ? "page" : undefined}
              className={`relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${on ? "text-white" : "text-zinc-500"}`}
            >
              <span className="relative">
                <Icon aria-hidden className={`size-5 ${on ? "text-[#00e5ff]" : ""}`} />
                {a.id === "rodada" && missions > 0 && (
                  <span className="absolute -right-2.5 -top-1.5">
                    <Badge n={missions} />
                  </span>
                )}
              </span>
              {a.label}
              {on && <span className="absolute inset-x-6 top-0 h-0.5 rounded-full bg-[#00e5ff]" />}
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
      className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#00e5ff] px-1 font-mono text-[10.5px] font-bold leading-none text-[#04141a]"
    >
      {n > 99 ? "99+" : n}
    </span>
  );
}

/** Cartão do jogador: nível e XP da temporada; clicar abre o menu do jogador. */
function PlayerChip({ pessoa, data }: { pessoa: NonNullable<HudPessoa>; data: Jogador | null }) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const span = data?.level.next ? (data.xp - data.level.from) / (data.level.next - data.level.from) : data ? 1 : 0;
  const nextName = data ? LEVELS[data.level.n]?.name : undefined;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const mine = data?.missions.mine ?? 0;
  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex h-9 items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] py-1 pl-1 pr-2.5 transition hover:border-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff]"
      >
        <span className="flex size-7 items-center justify-center rounded-full bg-[#00e5ff] text-[13px] font-extrabold text-[#04141a]">
          {pessoa.name.charAt(0)}
        </span>
        <span className="hidden flex-col items-start leading-none sm:flex">
          <span className="text-[12.5px] font-semibold text-white">{pessoa.name}</span>
          <span className="mt-1 flex items-center gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-zinc-400">
              {data?.owner ? `nv ${data.level.n} · ${data.xp} XP` : data ? "sem carteira" : "…"}
            </span>
            {data?.owner && (
              <span className="relative h-1 w-10 overflow-hidden rounded-full bg-white/10">
                <span className="absolute inset-y-0 left-0 rounded-full bg-[#00e5ff]" style={{ width: `${Math.round(Math.min(1, Math.max(0, span)) * 100)}%` }} />
              </span>
            )}
          </span>
        </span>
        <ChevronDown aria-hidden className={`size-3.5 text-zinc-500 transition ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            className="absolute right-0 top-11 z-50 w-[280px] rounded-2xl border border-white/10 bg-[#0c0e11] p-2 shadow-2xl"
            initial={reduce ? false : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
          >
            <div className="flex flex-col gap-2 px-3 pb-3 pt-2">
              <span className="text-[15px] font-semibold text-white">{pessoa.name}</span>
              {data?.owner ? (
                <>
                  <span className="flex items-baseline justify-between text-[12.5px] text-zinc-400">
                    <span>
                      Nível {data.level.n} · <b className="text-white">{data.level.name}</b>
                    </span>
                    <span className="font-mono text-white">{data.xp} XP</span>
                  </span>
                  <span className="relative h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
                    <span className="absolute inset-y-0 left-0 rounded-full bg-[#00e5ff]" style={{ width: `${Math.round(Math.min(1, Math.max(0, span)) * 100)}%` }} />
                  </span>
                  <span className="text-[12px] text-zinc-500">
                    {data.level.next !== null ? `${data.level.next - data.xp} XP para ${nextName}` : "nível máximo"}
                    {data.pos ? ` · ${data.pos}º na temporada` : ""}
                    {data.round ? ` · rodada ${data.round} de ${data.rounds}` : ""}
                  </span>
                </>
              ) : (
                <span className="text-[12.5px] text-zinc-500">{data ? "Sem cliente na sua carteira ainda." : "Carregando…"}</span>
              )}
            </div>
            <div className="flex flex-col border-t border-white/8 pt-1.5">
              <MenuLink href="/placar/semana#missoes" icon={<Target className="size-4" />} onClick={() => setOpen(false)}>
                {admin(pessoa) ? "Missões do time" : "Minhas missões"}
                {(admin(pessoa) ? data?.missions.team : mine) ? (
                  <span className="ml-auto font-mono text-[12px] text-[#7ff2ff]">{admin(pessoa) ? data?.missions.team : mine}</span>
                ) : null}
              </MenuLink>
              <MenuLink href="/placar/semana#temporada" icon={<Crown className="size-4" />} onClick={() => setOpen(false)}>
                Tabela da temporada
              </MenuLink>
              <MenuLink href="/placar" icon={<Gauge className="size-4" />} onClick={() => setOpen(false)}>
                Lançar números
              </MenuLink>
              <form action="/placar/sair" method="post">
                <button
                  type="submit"
                  role="menuitem"
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13.5px] text-zinc-400 hover:bg-white/[0.05] hover:text-white"
                >
                  <LogOut aria-hidden className="size-4" /> Sair
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const admin = (p: NonNullable<HudPessoa>) => p.role === "admin";

function MenuLink({ href, icon, children, onClick }: { href: string; icon: React.ReactNode; children: React.ReactNode; onClick: () => void }) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onClick}
      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] text-zinc-200 hover:bg-white/[0.05] hover:text-white"
    >
      <span aria-hidden className="text-zinc-400">
        {icon}
      </span>
      {children}
    </Link>
  );
}

/** No celular, reserva o espaço da barra do rodapé no fim da página. */
export function HudSpacer() {
  const pathname = usePathname();
  if (SEM_BARRA.some((p) => pathname.startsWith(p))) return null;
  return <div aria-hidden className="h-[72px] shrink-0 sm:hidden" />;
}
