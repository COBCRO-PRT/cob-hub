/**
 * Cartão do jogador para a barra do hub: nível, XP da temporada e missões abertas.
 * Leve de propósito: lê só o store, nunca o ClickUp. Regras em docs/navegacao.md.
 */
import { seasonTable, weekMissions } from "./jogo";
import { SEASON, levelFor, roundOf, type Level } from "./rodada-rules";
import { addWeeks, mondayOf } from "./score";
import type { PlacarStore } from "./store";

export interface Jogador {
  name: string;
  admin: boolean;
  /** Tem carteira no placar; sem carteira, XP e nível ficam de fora. */
  owner: boolean;
  xp: number;
  level: Level;
  /** Posição na tabela da temporada (1 = líder); null sem carteira. */
  pos: number | null;
  missions: { mine: number; team: number };
  week: string;
  round: number | null;
  rounds: number;
}

export async function jogador(store: PlacarStore, name: string, admin: boolean): Promise<Jogador> {
  const week = mondayOf(new Date());
  const [clients, entries, frozen, tasks] = await Promise.all([
    store.listClients(),
    store.listEntries(addWeeks(week, -60)),
    store.listRodada(addWeeks(week, -60) < SEASON.start ? addWeeks(week, -60) : SEASON.start),
    store.listTasks(),
  ]);
  const owners = [...new Set(clients.filter((c) => c.active).map((c) => c.owner.trim()))];
  const table = seasonTable(frozen, tasks, owners);
  const idx = table.findIndex((l) => l.owner === name);
  const line = idx >= 0 ? table[idx] : null;
  const open = weekMissions(clients, entries, frozen, week).missions.filter((m) => !m.done);
  return {
    name,
    admin,
    owner: line !== null,
    xp: line?.xp ?? 0,
    level: line?.level ?? levelFor(0),
    pos: line ? idx + 1 : null,
    missions: { mine: open.filter((m) => m.owner === name).length, team: open.length },
    week,
    round: roundOf(week),
    rounds: SEASON.rounds,
  };
}
