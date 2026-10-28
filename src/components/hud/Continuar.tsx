"use client";

import { Clock, Play, Target, Trophy } from "lucide-react";
import { Button, Label, Notice, Score, Skeleton, Surface } from "@/components/ui";
import { closesAt, countdown, useNow } from "@/components/placar/semana/comum";
import type { HudPessoa } from "./Hud";
import { retryPlayer, usePlayer } from "./usePlayer";

/** O gesto-herói do Início (§6.2): a rodada da semana, a meta do time num anel e as missões abertas. */
export function Continuar({ pessoa }: { pessoa: HudPessoa }) {
  const player = usePlayer(Boolean(pessoa));
  const now = useNow();
  const d = player.data;

  if (!pessoa) {
    return (
      <Surface glow className="flex flex-wrap items-center justify-between gap-5 px-5 py-5 sm:px-6">
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label tone="accent">Rodada da semana</Label>
          <h2 className="type-title text-fg">Entre para jogar a rodada</h2>
          <p className="type-body text-mute">Com o seu login você vê suas missões, seu nível e o pódio da semana.</p>
        </div>
        <Button variant="primary" size="lg" href="/placar/entrar?next=%2Fplacar%2Fsemana" iconEnd={<Play aria-hidden strokeWidth={2} />}>
          Entrar
        </Button>
      </Surface>
    );
  }

  const admin = pessoa.role === "admin";
  const missions = d ? (admin ? d.missions.team : d.missions.mine) : null;
  const team = d?.team;
  const pct = team && team.total > 0 ? team.green / team.total : 0;

  return (
    <Surface glow className="flex flex-wrap items-center gap-5 px-5 py-5 sm:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-5">
        {team ? (
          <Score value={pct * 10} tone={pct * 100 >= team.goalPct ? "good" : pct >= 0.4 ? "warn" : "bad"} size={56} label={`${team.green} de ${team.total} clientes no verde, meta ${team.goalPct}%`} />
        ) : (
          <Skeleton shape="ring" className="[&>div]:size-14" />
        )}
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label tone="accent">{d?.round ? `Rodada ${d.round} de ${d.rounds}` : "Rodada da semana"}</Label>
          <h2 className="type-title text-fg">
            {team ? `${team.green} de ${team.total} no verde` : "Continuar a rodada"}
          </h2>
          <div className="flex flex-wrap gap-x-4 gap-y-1 type-body text-mute">
            {team && (
              <span className="inline-flex items-center gap-1.5">
                <Trophy aria-hidden className="size-4 text-dim" strokeWidth={1.75} />
                meta do time {team.goalPct}%
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <Target aria-hidden className="size-4 text-accent" strokeWidth={1.75} />
              {missions === null ? (
                <Skeleton className="w-24" />
              ) : (
                <>
                  <b className="font-semibold tabular-nums text-fg">{missions}</b>
                  {missions === 1 ? "missão aberta" : "missões abertas"}
                  {admin ? " no time" : ""}
                </>
              )}
            </span>
            {d && now && (
              <span className="inline-flex items-center gap-1.5">
                <Clock aria-hidden className="size-4 text-dim" strokeWidth={1.75} />
                fecha em <b className="font-semibold tabular-nums text-fg">{countdown(closesAt(d.week) - now)}</b>
              </span>
            )}
          </div>
          {player.status === "error" && (
            <Notice tone="bad" action={<Button size="sm" variant="danger" onClick={retryPlayer}>Tentar de novo</Button>}>
              Não deu para ler a rodada. {player.error}
            </Notice>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" size="lg" href="/placar/semana#missoes" iconEnd={<Play aria-hidden strokeWidth={2} />}>
          Continuar a rodada
        </Button>
        <Button size="lg" href="/placar">
          Lançar números
        </Button>
      </div>
    </Surface>
  );
}
