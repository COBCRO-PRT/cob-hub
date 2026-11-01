"use client";

import { Clock, Play, Target } from "lucide-react";
import { Button, Gauge, Label, Notice, PlayerLevel, Skeleton, Surface } from "@/components/ui";
import { closesAt, countdown, useNow } from "@/components/placar/semana/comum";
import type { HudPessoa } from "@/components/shell/Shell";
import { LEVELS } from "@/lib/placar/rodada-rules";
import { HomeKpis } from "./HomeKpis";
import { retryPlayer, usePlayer } from "./usePlayer";

type Props = {
  pessoa: HudPessoa;
  /** "Boa tarde", calculado no servidor no fuso do Brasil. */
  saudacao: string;
  /** "sábado, 1 de novembro". */
  data: string;
};

/**
 * O topo do Início (D2.5): herói com o medidor da meta do time, cartão do jogador e os três KPIs
 * das últimas semanas, numa grade bento de 12 colunas.
 */
export function Continuar({ pessoa, saudacao, data }: Props) {
  const player = usePlayer(Boolean(pessoa));
  const now = useNow();
  const d = player.data;

  if (!pessoa) {
    return (
      <div className="grid grid-cols-12 gap-4">
        <Surface glow light className="col-span-12 flex flex-wrap items-center justify-between gap-5 px-5 py-5 sm:px-6">
          <div className="flex min-w-0 flex-col gap-1.5">
            <Label>{data}</Label>
            <h1 className="type-title text-fg">Entre para jogar a rodada</h1>
            <p className="type-body text-mute">Com o seu login você vê suas missões, seu nível e o pódio da semana.</p>
          </div>
          <Button variant="primary" size="lg" href="/placar/entrar?next=%2Fplacar%2Fsemana" iconEnd={<Play aria-hidden strokeWidth={2} />}>
            Entrar
          </Button>
        </Surface>
      </div>
    );
  }

  const admin = pessoa.role === "admin";
  const missions = d ? (admin ? d.missions.team : d.missions.mine) : null;
  const team = d?.team;
  const pct = team && team.total > 0 ? Math.round((team.green / team.total) * 100) : 0;
  const nextName = d ? LEVELS[d.level.n]?.name : undefined;

  return (
    <div className="grid grid-cols-12 gap-4">
      <Surface glow light className="col-span-12 flex flex-col gap-6 px-5 py-5 sm:px-6 lg:col-span-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
          {team ? (
            <Gauge value={pct} marker={team.goalPct} size={200} className="self-center" label={`${team.green} de ${team.total} clientes no verde, meta ${team.goalPct}%`}>
              <span className="type-metric-lg text-fg">{pct}%</span>
              <span className="type-caption text-mute">no verde</span>
            </Gauge>
          ) : (
            <Skeleton shape="metric" className="w-[200px] [&>div]:h-[108px] [&>div]:w-full [&>div]:rounded-card" />
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <h1 className="type-title text-fg">
              {saudacao}, {pessoa.name}
            </h1>
            <p className="type-caption text-mute">
              {d?.round ? `Rodada ${d.round} de ${d.rounds} · ` : ""}
              {data}
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 type-body text-mute">
              <span className="inline-flex items-center gap-1.5">
                <Target aria-hidden className="size-4 text-dim" strokeWidth={1.75} />
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
              {team && (
                <span className="inline-flex items-center gap-1.5">
                  <b className="font-semibold tabular-nums text-fg">{team.green}</b> de {team.total} no verde, meta {team.goalPct}%
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
          <Button variant="soft" size="lg" href="/placar">
            Lançar números
          </Button>
        </div>
      </Surface>

      <Surface light className="col-span-12 flex flex-col gap-4 px-5 py-5 lg:col-span-4">
        <div className="flex flex-col gap-0.5">
          <Label>Jogador</Label>
          <span className="type-subtitle text-fg">{pessoa.name}</span>
        </div>
        {player.status === "loading" && <Skeleton lines={3} />}
        {d?.owner && (
          <>
            <PlayerLevel xp={d.xp} level={d.level} size="md" />
            <p className="type-caption text-dim">
              {d.pos ? `${d.pos}º na temporada` : "fora da tabela"}
              {nextName && d.level.next !== null ? ` · próximo nível: ${nextName}` : ""}
              {d.level.next === null ? " · nível máximo" : ""}
            </p>
          </>
        )}
        {d && !d.owner && <p className="type-caption text-dim">Sem cliente na sua carteira ainda. Quando tiver, seu nível e XP aparecem aqui.</p>}
        {player.status === "error" && !d && <p className="type-caption text-dim">Sem leitura do cartão.</p>}
      </Surface>

      <HomeKpis />
    </div>
  );
}
