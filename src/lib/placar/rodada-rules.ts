/**
 * Números da Rodada da semana, num arquivo sem dependência de servidor para a
 * tela e o fechamento lerem os mesmos valores. Regras em docs/placar-semana.md.
 */
import { lastClosedWeek } from "./score";

/** Primeira rodada do trimestre nov a jan (fecha em 02/11/2026). */
export const QUARTER_START = "2026-10-26";

/** Rodada que a tela abre sem parâmetro: a última semana terminada; antes da 1ª rodada, a própria 1ª (em prévia). */
export function defaultRodadaWeek(): string {
  const w = lastClosedWeek();
  return w < QUARTER_START ? QUARTER_START : w;
}
/** Meta do time: parte da carteira ativa no verde em janeiro. */
export const TEAM_GOAL = 0.7;
export const POINTS = { leitura: 1, verde: 2, virada: 5, sequencia: 5 } as const;
/** Sequência premiada a cada 4 rodadas seguidas no verde; vermelho por 4 rodadas escala a tarefa. */
export const STREAK = 4;

// ---------- camada de jogo ----------

/** Temporada 1: 14 rodadas, da semana de 26/10/2026 à de 25/01/2027. */
export const SEASON = { name: "Temporada 1", start: QUARTER_START, rounds: 14 } as const;

/** Rodada da temporada (1 a 14) de uma segunda-feira; fora da temporada, null. */
export function roundOf(week: string): number | null {
  const n = Math.round((Date.parse(week + "T00:00:00Z") - Date.parse(SEASON.start + "T00:00:00Z")) / (7 * 86400000)) + 1;
  return n >= 1 && n <= SEASON.rounds ? n : null;
}

/** XP da rodada: a média de pontos por cliente, × 10 e sem vírgula. */
export const xpOf = (avg: number) => Math.round(avg * 10);

export const LEVELS = [
  { n: 1, name: "Estreante", from: 0 },
  { n: 2, name: "Titular", from: 60 },
  { n: 3, name: "Destaque", from: 150 },
  { n: 4, name: "Craque", from: 270 },
  { n: 5, name: "Lenda", from: 400 },
] as const;

export interface Level {
  n: number;
  name: string;
  from: number;
  /** XP do próximo nível; null no último. */
  next: number | null;
}

export function levelFor(xp: number): Level {
  let i = 0;
  while (i + 1 < LEVELS.length && xp >= LEVELS[i + 1].from) i++;
  const l = LEVELS[i];
  return { n: l.n, name: l.name, from: l.from, next: LEVELS[i + 1]?.from ?? null };
}

export const ACHIEVEMENTS = [
  { id: "virada", name: "Virada", how: "Virar um cliente do vermelho" },
  { id: "hat-trick", name: "Hat-trick", how: "3 viradas na temporada" },
  { id: "selo", name: "Pronto para indicação", how: `Um cliente com ${STREAK} rodadas seguidas no verde` },
  { id: "carteira-lida", name: "Carteira lida", how: "Uma rodada com todos os clientes com leitura" },
  { id: "zero-vermelho", name: "Zero vermelho", how: "Uma rodada com todos lidos e nenhum vermelho" },
  { id: "tudo-verde", name: "Tudo verde", how: "Uma rodada com a carteira inteira no verde" },
  { id: "lider", name: "Líder da rodada", how: "Terminar uma rodada em 1º lugar" },
  { id: "plano-72h", name: "Plano em 72h", how: "Fechar uma tarefa de recuperação em até 72h" },
] as const;

export type AchievementId = (typeof ACHIEVEMENTS)[number]["id"];
