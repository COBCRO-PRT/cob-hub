/**
 * Tipos do Placar de Clientes.
 *
 * Os nomes dos campos são os mesmos das colunas do Supabase (supabase/placar.sql)
 * e do arquivo local de desenvolvimento, então nada é traduzido no caminho.
 */

export type ClientKind = "resultado" | "projeto";
export type MetaPeriod = "dia" | "semana" | "mes";
export type MetaMode = "soma" | "taxa" | "custo";
/** Tipo de resultado que a mídia entrega (docs/placar-benchmark.md). Vazio = sem mídia. */
export type ResultKind = "" | "lead" | "conversa" | "venda";
/** Quem gravou o lançamento: a leitura automática ou uma pessoa. */
export type EntrySource = "" | "auto" | "manual";
/** Degrau da escada de benchmark. Vazio = a medir. */
export type Tier = "" | "ouro" | "prata" | "bronze" | "abaixo";

/** Gasto e resultado de uma plataforma dentro do lançamento. */
export interface PlatformDetail {
  spend?: number;
  lead?: number;
  conversa?: number;
  venda?: number;
  found?: boolean;
}
export interface EntryDetail {
  meta?: PlatformDetail;
  google?: PlatformDetail;
}

/** Curva de referência de um grupo (tabela placar_benchmarks). */
export interface Benchmark {
  /** `<sector>_<result_kind>_<platform>` */
  id: string;
  sector: string;
  result_kind: Exclude<ResultKind, "">;
  platform: "meta" | "google";
  metric: "custo" | "roas";
  p25: number | null;
  p50: number | null;
  p75: number | null;
  p90: number | null;
  source: string;
  captured_at: string | null;
  updated_at: string;
}

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
  /** Grupo de comparação: setor e tipo de resultado (docs/placar-benchmark.md). */
  sector: string;
  result_kind: ResultKind;
  /** Ids das contas de anúncio, para a leitura automática. */
  ads_meta: string;
  ads_google: string;
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
  /** Gasto Meta + Google na janela do lançamento, em reais. Nulo quando ninguém leu a mídia. */
  spend: number | null;
  detail: EntryDetail;
  source: EntrySource;
  updated_at: string;
}

export type Audience = "team" | "finance";

export interface PlacarSnapshot {
  clients: BoardClient[];
  entries: PlacarEntry[];
  benchmarks: Benchmark[];
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
  /** "virada", "sequencia", "degrau". */
  badges: string[];
  /** Degrau no fechamento (docs/placar-benchmark.md). */
  tier: Tier;
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
