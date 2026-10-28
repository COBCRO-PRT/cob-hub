"use client";

import Link from "next/link";
import { Clock, Play, Target, Trophy } from "lucide-react";
import { closesAt, countdown, useNow } from "@/components/placar/semana/comum";
import { btnGhost, btnPrimary } from "@/components/placar/tones";
import type { HudPessoa } from "./Hud";
import { usePlayer } from "./usePlayer";

/** "Continuar" da tela inicial: a rodada da semana, quanto falta para fechar e as missões abertas. */
export function Continuar({ pessoa }: { pessoa: HudPessoa }) {
  const player = usePlayer(Boolean(pessoa));
  const now = useNow();
  const d = player.data;

  if (!pessoa) {
    return (
      <Card>
        <div className="flex min-w-0 flex-col gap-1.5">
          <Eyebrow>Rodada da semana</Eyebrow>
          <h2 className="text-[22px] font-bold tracking-tight text-white">Entre para jogar a rodada</h2>
          <p className="text-[14px] text-zinc-400">Com o seu login você vê suas missões, seu nível e o pódio da semana.</p>
        </div>
        <Link href="/placar/entrar?next=%2Fplacar%2Fsemana" className={`${btnPrimary} h-11 px-6 text-[14px]`}>
          Entrar
        </Link>
      </Card>
    );
  }

  const admin = pessoa.role === "admin";
  const missions = d ? (admin ? d.missions.team : d.missions.mine) : null;
  return (
    <Card>
      <div className="flex min-w-0 flex-col gap-2">
        <Eyebrow>
          {d?.round ? `Temporada 1 · rodada ${d.round} de ${d.rounds}` : "Rodada da semana"}
        </Eyebrow>
        <h2 className="text-[22px] font-bold tracking-tight text-white">Continuar a rodada, {pessoa.name}</h2>
        <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-[13.5px] text-zinc-400">
          <span className="inline-flex items-center gap-1.5">
            <Target aria-hidden className="size-4 text-[#00e5ff]" />
            {missions === null ? "…" : (
              <>
                <b className="font-mono text-white">{missions}</b>{" "}
                {missions === 1 ? "missão aberta" : "missões abertas"}
                {admin ? " no time" : ""}
              </>
            )}
          </span>
          {d && now && (
            <span className="inline-flex items-center gap-1.5">
              <Clock aria-hidden className="size-4 text-zinc-500" />
              fecha em <b className="font-mono text-white">{countdown(closesAt(d.week) - now)}</b>
            </span>
          )}
          {d?.owner && (
            <span className="inline-flex items-center gap-1.5">
              <Trophy aria-hidden className="size-4 text-zinc-500" />
              nível {d.level.n} {d.level.name} · <b className="font-mono text-white">{d.xp} XP</b>
              {d.pos ? ` · ${d.pos}º` : ""}
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href="/placar/semana#missoes" className={`${btnPrimary} h-11 gap-2 px-6 text-[14px]`}>
          <Play aria-hidden className="size-4" /> Continuar a rodada
        </Link>
        <Link href="/placar" className={`${btnGhost} h-11 px-5 text-[14px]`}>
          Lançar números
        </Link>
      </div>
    </Card>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section
      aria-label="Continuar"
      className="relative flex flex-wrap items-center justify-between gap-5 overflow-hidden rounded-2xl border border-[#00e5ff]/35 bg-[radial-gradient(120%_140%_at_0%_0%,rgba(0,229,255,0.12),transparent_55%)] px-6 py-5"
    >
      {children}
    </section>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#00e5ff]">{children}</span>;
}
