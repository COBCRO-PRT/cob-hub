"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronDown, Crown, Gauge, LogOut, Target } from "lucide-react";
import { Button, Notice, PlayerLevel, Skeleton, dur, ease } from "@/components/ui";
import { LEVELS } from "@/lib/placar/rodada-rules";
import { cn } from "@/lib/utils";
import type { HudPessoa } from "./Hud";
import { retryPlayer, type PlayerState } from "./usePlayer";

/** Cartão do jogador na barra (§6.1): avatar, nome, nível. Clicar abre o menu do jogador. */
export function PlayerCard({ pessoa, player }: { pessoa: NonNullable<HudPessoa>; player: PlayerState }) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const admin = pessoa.role === "admin";
  const data = player.data;
  const gold = data?.level.name === "Lenda";
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

  const missions = admin ? data?.missions.team : data?.missions.mine;

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Jogador ${pessoa.name}`}
        className="flex h-9 items-center gap-2 rounded-full border border-line bg-surface-1 py-1 pr-2.5 pl-1 shadow-relief outline-none motion-safe:transition-colors hover:border-line-strong hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <span className={cn("flex size-7 items-center justify-center rounded-full text-sm font-extrabold", gold ? "bg-gold text-accent-fg" : "bg-accent text-accent-fg")}>
          {pessoa.name.charAt(0)}
        </span>
        <span className="hidden min-w-[88px] flex-col items-stretch gap-1 sm:flex">
          <span className="type-caption leading-none font-semibold text-fg">{pessoa.name}</span>
          {player.status === "loading" ? (
            <Skeleton className="w-full" />
          ) : data?.owner ? (
            <span className="flex items-center gap-1.5">
              <span className={cn("type-label leading-none", gold ? "text-gold" : "text-dim")}>nv {data.level.n}</span>
              <span className="relative h-1 flex-1 overflow-hidden rounded-full bg-line">
                <span className={cn("absolute inset-y-0 left-0 rounded-full", gold ? "bg-gold" : "bg-accent")} style={{ width: `${levelPct(data.xp, data.level.from, data.level.next)}%` }} />
              </span>
            </span>
          ) : (
            <span className="type-label leading-none text-dim">{player.status === "error" ? "sem leitura" : "sem carteira"}</span>
          )}
        </span>
        <ChevronDown aria-hidden className={cn("size-3.5 text-dim motion-safe:transition-transform", open && "rotate-180")} strokeWidth={1.75} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            className="absolute top-11 right-0 z-50 w-[300px] rounded-panel border border-line bg-surface-1 p-2 shadow-float"
            initial={reduce ? false : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: dur.base, ease: ease.std }}
          >
            <div className="flex flex-col gap-3 px-3 pt-2 pb-3">
              <span className="type-subtitle text-fg">{pessoa.name}</span>
              {player.status === "loading" && <Skeleton lines={2} />}
              {player.status === "error" && (
                <div className="flex flex-col gap-2">
                  <Notice tone="bad" title="Não deu para ler seu cartão">
                    {player.error}
                  </Notice>
                  <Button size="sm" variant="danger" onClick={retryPlayer} className="self-start">
                    Tentar de novo
                  </Button>
                </div>
              )}
              {data?.owner && (
                <>
                  <PlayerLevel xp={data.xp} level={data.level} size="md" />
                  <span className="type-caption text-dim">
                    {data.level.next !== null ? `${data.level.next - data.xp} XP para ${nextName}` : "nível máximo"}
                    {data.pos ? ` · ${data.pos}º na temporada` : ""}
                    {data.round ? ` · rodada ${data.round} de ${data.rounds}` : ""}
                  </span>
                </>
              )}
              {data && !data.owner && <span className="type-caption text-dim">Sem cliente na sua carteira ainda.</span>}
            </div>
            <div className="flex flex-col border-t border-line pt-1.5">
              <MenuLink href="/placar/semana#missoes" icon={<Target aria-hidden className="size-4" strokeWidth={1.75} />} onClick={() => setOpen(false)}>
                {admin ? "Missões do time" : "Minhas missões"}
                {missions ? <span className="ml-auto type-caption tabular-nums text-accent-text">{missions}</span> : null}
              </MenuLink>
              <MenuLink href="/placar/semana#temporada" icon={<Crown aria-hidden className="size-4" strokeWidth={1.75} />} onClick={() => setOpen(false)}>
                Tabela da temporada
              </MenuLink>
              <MenuLink href="/placar" icon={<Gauge aria-hidden className="size-4" strokeWidth={1.75} />} onClick={() => setOpen(false)}>
                Lançar números
              </MenuLink>
              <form action="/placar/sair" method="post">
                <button type="submit" role="menuitem" className={MENU_ITEM}>
                  <LogOut aria-hidden className="size-4 text-dim" strokeWidth={1.75} /> Sair
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function levelPct(xp: number, from: number, next: number | null) {
  if (next === null) return 100;
  return Math.round(Math.min(1, Math.max(0, (xp - from) / (next - from))) * 100);
}

const MENU_ITEM =
  "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left type-body text-fg outline-none motion-safe:transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent";

function MenuLink({ href, icon, children, onClick }: { href: string; icon: React.ReactNode; children: React.ReactNode; onClick: () => void }) {
  return (
    <Link href={href} role="menuitem" onClick={onClick} className={MENU_ITEM}>
      <span className="text-dim">{icon}</span>
      {children}
    </Link>
  );
}
