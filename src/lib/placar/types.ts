/**
 * Tipos do Placar de Clientes.
 *
 * Os nomes dos campos são os mesmos das colunas do Supabase (supabase/placar.sql)
 * e do arquivo local de desenvolvimento, então nada é traduzido no caminho.
 */

export type ClientKind = "resultado" | "projeto";
export type MetaPeriod = "dia" | "semana" | "mes";
export type MetaMode = "soma" | "taxa" | "custo";

export interface PlacarClient {
  /** Slug do nome. Também é o nome do arquivo na semente. */
  id: string;
  name: string;
  owner: string;
  owner_ok: boolean;
  /** Mensalidade em reais. Só sai do servidor para a área do financeiro. */
  fee: number | null;
  delivers: string;
  kind: ClientKind;
  meta_value: number | null;
  meta_label: string;
  meta_period: MetaPeriod;
  meta_mode: MetaMode;
  meta_note: string;
  meta_review: boolean;
  active: boolean;
  updated_at: string;
}

/** O que o time recebe: o cliente sem nenhum valor em reais. */
export type TeamClient = Omit<PlacarClient, "fee">;

/** Cliente como chega na tela; `fee` só existe na visão do financeiro. */
export type BoardClient = TeamClient & { fee?: number | null };

export interface PlacarEntry {
  /** `<client>_<week>`, um lançamento por cliente por semana. */
  id: string;
  client: string;
  /** Segunda-feira da semana, AAAA-MM-DD. */
  week: string;
  /** 1 para a semana, 4 quando o número é do mês inteiro. */
  weeks: number;
  value: number | null;
  milestone: boolean | null;
  client_score: number | null;
  note: string;
  updated_at: string;
}

export type Audience = "team" | "finance";

export interface PlacarSnapshot {
  clients: BoardClient[];
  entries: PlacarEntry[];
  /** Onde os dados moram. "file" aparece como aviso na tela, para ninguém lançar no lugar errado. */
  store: "supabase" | "file";
}

/** Faixa da nota. Igual ao `Tone` de score.ts, repetido aqui para os tipos não dependerem da régua. */
export type RodadaTone = "good" | "warn" | "bad" | "none";

/** Nota e pontos de um cliente numa rodada fechada (tabela placar_rodada). */
export interface RodadaRow {
  /** Segunda-feira da rodada. */
  week: string;
  client: string;
  /** Dono no momento do fechamento. */
  owner: string;
  tone: RodadaTone;
  score: number | null;
  points: number;
  /** "virada", "sequencia". */
  badges: string[];
  closed_at: string;
}

/** Tarefa do ClickUp de um cliente que ficou vermelho (tabela placar_tasks). */
export interface PlacarTask {
  /** Id da tarefa no ClickUp. */
  id: string;
  client: string;
  /** Rodada em que o cliente ficou vermelho. */
  week: string;
  url: string;
  status: string;
  closed: boolean;
  /** Quando fechou no ClickUp. Nulo se está aberta ou sumiu da lista. */
  closed_at: string | null;
  escalated_at: string | null;
  created_at: string;
  synced_at: string;
}
