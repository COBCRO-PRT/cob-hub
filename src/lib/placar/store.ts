/**
 * Camada de dados do Placar de Clientes. Só roda no servidor.
 *
 * Duas implementações atrás da mesma interface:
 * - Supabase (PostgREST com a chave service_role), quando PLACAR_SUPABASE_URL e
 *   PLACAR_SUPABASE_SERVICE_KEY existem. A chave nunca vai para o navegador.
 * - Arquivo JSON local, para desenvolvimento, quando essas variáveis faltam.
 *   Fica fora do repositório (~/.cob-hub/placar-dev.json ou PLACAR_FILE).
 *   Na Vercel o arquivo é recusado: sem banco configurado o placar dá erro claro
 *   em vez de gravar num disco que some a cada deploy.
 *
 * Este arquivo também é importado pelo script de semente rodando direto no
 * Node, então não usa alias `@/` e só importa tipos.
 */
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type {
  Benchmark,
  ClientKind,
  EntryDetail,
  EntrySource,
  MetaMode,
  MetaPeriod,
  PlacarClient,
  PlacarEntry,
  PlacarTask,
  ResultKind,
  RodadaRow,
  RodadaTone,
  Tier,
} from "./types";

export class PlacarConflictError extends Error {}

export interface PlacarStore {
  readonly kind: "supabase" | "file";
  /** Onde os dados moram, para log do script de semente. Sem segredo. */
  readonly where: string;
  listClients(): Promise<PlacarClient[]>;
  getClient(id: string): Promise<PlacarClient | null>;
  /** Cria. Lança PlacarConflictError se o id já existe. */
  insertClient(client: PlacarClient): Promise<PlacarClient>;
  /** Atualiza só os campos enviados. Campo ausente fica como está (é assim que o time não toca na mensalidade). */
  updateClient(id: string, patch: Partial<Omit<PlacarClient, "id">>): Promise<PlacarClient | null>;
  /** Semente: grava se não existe. Com overwrite, substitui. Devolve true quando gravou. */
  seedClient(client: PlacarClient, overwrite: boolean): Promise<boolean>;
  /** Lançamentos com semana a partir de `fromWeek` (inclusive). */
  listEntries(fromWeek: string): Promise<PlacarEntry[]>;
  /** Grava o lançamento inteiro (substitui o anterior da mesma semana). */
  putEntry(entry: PlacarEntry): Promise<PlacarEntry>;
  deleteEntry(id: string): Promise<boolean>;
  /** Linhas de rodadas fechadas a partir de `fromWeek` (inclusive). */
  listRodada(fromWeek: string): Promise<RodadaRow[]>;
  /** Fecha uma rodada. Linha que já existe não é sobrescrita: rodada fechada é congelada. Devolve quantas gravou. */
  insertRodada(rows: RodadaRow[]): Promise<number>;
  listTasks(): Promise<PlacarTask[]>;
  /** Grava a tarefa inteira (cria ou substitui pelo id). */
  putTask(task: PlacarTask): Promise<PlacarTask>;
  /** Curvas de referência (placar_benchmarks). */
  listBenchmarks(): Promise<Benchmark[]>;
}

// ---------- normalização ----------

const str = (v: unknown) => (typeof v === "string" ? v : v === null || v === undefined ? "" : String(v));
const numOrNull = (v: unknown) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(v as T) ? (v as T) : fallback;

export function normalizeClient(row: Record<string, unknown>): PlacarClient {
  return {
    id: str(row.id),
    name: str(row.name),
    owner: str(row.owner),
    owner_ok: row.owner_ok === true,
    fee: numOrNull(row.fee),
    delivers: str(row.delivers),
    kind: oneOf<ClientKind>(row.kind, ["resultado", "projeto"], "resultado"),
    meta_value: numOrNull(row.meta_value),
    meta_label: str(row.meta_label),
    meta_period: oneOf<MetaPeriod>(row.meta_period, ["dia", "semana", "mes"], "mes"),
    meta_mode: oneOf<MetaMode>(row.meta_mode, ["soma", "taxa", "custo"], "soma"),
    meta_note: str(row.meta_note),
    meta_review: row.meta_review === true,
    active: row.active !== false,
    sector: str(row.sector),
    result_kind: oneOf<ResultKind>(row.result_kind, ["", "lead", "conversa", "venda"], ""),
    ads_meta: str(row.ads_meta),
    ads_google: str(row.ads_google),
    updated_at: str(row.updated_at) || new Date().toISOString(),
  };
}

export function normalizeEntry(row: Record<string, unknown>): PlacarEntry {
  const weeks = Number(row.weeks);
  return {
    id: str(row.id),
    client: str(row.client),
    week: str(row.week).slice(0, 10),
    weeks: Number.isFinite(weeks) && weeks > 1 ? Math.round(weeks) : 1,
    value: numOrNull(row.value),
    milestone: typeof row.milestone === "boolean" ? row.milestone : null,
    client_score: numOrNull(row.client_score),
    note: str(row.note),
    spend: numOrNull(row.spend),
    detail: row.detail && typeof row.detail === "object" && !Array.isArray(row.detail) ? (row.detail as EntryDetail) : {},
    source: oneOf<EntrySource>(row.source, ["", "auto", "manual"], ""),
    updated_at: str(row.updated_at) || new Date().toISOString(),
  };
}

export function normalizeRodada(row: Record<string, unknown>): RodadaRow {
  return {
    week: str(row.week).slice(0, 10),
    client: str(row.client),
    owner: str(row.owner),
    tone: oneOf<RodadaTone>(row.tone, ["good", "warn", "bad", "none"], "none"),
    score: numOrNull(row.score),
    points: Number(row.points) || 0,
    badges: Array.isArray(row.badges) ? row.badges.map(str) : [],
    tier: oneOf<Tier>(row.tier, ["", "ouro", "prata", "bronze", "abaixo"], ""),
    closed_at: str(row.closed_at) || new Date().toISOString(),
  };
}

export function normalizeBenchmark(row: Record<string, unknown>): Benchmark {
  return {
    id: str(row.id),
    sector: str(row.sector),
    result_kind: oneOf<Exclude<ResultKind, "">>(row.result_kind, ["lead", "conversa", "venda"], "lead"),
    platform: oneOf<"meta" | "google">(row.platform, ["meta", "google"], "meta"),
    metric: oneOf<"custo" | "roas">(row.metric, ["custo", "roas"], "custo"),
    p25: numOrNull(row.p25),
    p50: numOrNull(row.p50),
    p75: numOrNull(row.p75),
    p90: numOrNull(row.p90),
    source: str(row.source),
    captured_at: str(row.captured_at).slice(0, 10) || null,
    updated_at: str(row.updated_at) || new Date().toISOString(),
  };
}

export function normalizeTask(row: Record<string, unknown>): PlacarTask {
  const now = new Date().toISOString();
  return {
    id: str(row.id),
    client: str(row.client),
    week: str(row.week).slice(0, 10),
    url: str(row.url),
    status: str(row.status),
    closed: row.closed === true,
    closed_at: str(row.closed_at) || null,
    escalated_at: str(row.escalated_at) || null,
    created_at: str(row.created_at) || now,
    synced_at: str(row.synced_at) || now,
  };
}

// ---------- Supabase ----------

function supabaseStore(url: string, key: string): PlacarStore {
  const base = `${url.replace(/\/+$/, "")}/rest/v1`;
  const headers = (extra: Record<string, string> = {}) => ({
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    ...extra,
  });

  async function call(path: string, init: RequestInit & { prefer?: string } = {}) {
    const { prefer, ...rest } = init;
    const res = await fetch(`${base}${path}`, {
      ...rest,
      headers: headers(prefer ? { Prefer: prefer } : {}),
      cache: "no-store",
    });
    const text = await res.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    if (res.status === 409) {
      throw new PlacarConflictError("Já existe um registro com esse id.");
    }
    if (!res.ok) {
      const msg =
        body && typeof body === "object" && "message" in body ? String((body as { message: unknown }).message) : text;
      throw new Error(`Supabase respondeu ${res.status}: ${msg.slice(0, 300)}`);
    }
    return body;
  }

  const rows = (b: unknown) => (Array.isArray(b) ? (b as Record<string, unknown>[]) : []);
  const eq = (v: string) => `eq.${encodeURIComponent(v)}`;

  return {
    kind: "supabase",
    where: new URL(url).host,

    async listClients() {
      return rows(await call("/placar_clients?select=*&order=name.asc")).map(normalizeClient);
    },

    async getClient(id) {
      const r = rows(await call(`/placar_clients?select=*&id=${eq(id)}`));
      return r[0] ? normalizeClient(r[0]) : null;
    },

    async insertClient(client) {
      const r = rows(
        await call("/placar_clients", { method: "POST", body: JSON.stringify(client), prefer: "return=representation" }),
      );
      return normalizeClient(r[0] ?? client);
    },

    async updateClient(id, patch) {
      const r = rows(
        await call(`/placar_clients?id=${eq(id)}`, {
          method: "PATCH",
          body: JSON.stringify(patch),
          prefer: "return=representation",
        }),
      );
      return r[0] ? normalizeClient(r[0]) : null;
    },

    async seedClient(client, overwrite) {
      const r = rows(
        await call("/placar_clients?on_conflict=id", {
          method: "POST",
          body: JSON.stringify(client),
          prefer: `resolution=${overwrite ? "merge" : "ignore"}-duplicates,return=representation`,
        }),
      );
      return r.length > 0;
    },

    async listEntries(fromWeek) {
      // O Supabase corta em 1000 linhas por resposta; pagina para não perder lançamento.
      const page = 1000;
      const out: PlacarEntry[] = [];
      for (let offset = 0; ; offset += page) {
        const r = rows(
          await call(
            `/placar_entries?select=*&week=gte.${encodeURIComponent(fromWeek)}&order=week.asc,id.asc&limit=${page}&offset=${offset}`,
          ),
        );
        out.push(...r.map(normalizeEntry));
        if (r.length < page) break;
      }
      return out;
    },

    async putEntry(entry) {
      const r = rows(
        await call("/placar_entries?on_conflict=id", {
          method: "POST",
          body: JSON.stringify(entry),
          prefer: "resolution=merge-duplicates,return=representation",
        }),
      );
      return normalizeEntry(r[0] ?? entry);
    },

    async deleteEntry(id) {
      const r = rows(await call(`/placar_entries?id=${eq(id)}`, { method: "DELETE", prefer: "return=representation" }));
      return r.length > 0;
    },

    async listRodada(fromWeek) {
      const page = 1000;
      const out: RodadaRow[] = [];
      for (let offset = 0; ; offset += page) {
        const r = rows(
          await call(
            `/placar_rodada?select=*&week=gte.${encodeURIComponent(fromWeek)}&order=week.asc,client.asc&limit=${page}&offset=${offset}`,
          ),
        );
        out.push(...r.map(normalizeRodada));
        if (r.length < page) break;
      }
      return out;
    },

    async insertRodada(list) {
      if (!list.length) return 0;
      const r = rows(
        await call("/placar_rodada?on_conflict=week,client", {
          method: "POST",
          body: JSON.stringify(list),
          prefer: "resolution=ignore-duplicates,return=representation",
        }),
      );
      return r.length;
    },

    async listTasks() {
      return rows(await call("/placar_tasks?select=*&order=created_at.asc")).map(normalizeTask);
    },

    async putTask(task) {
      const r = rows(
        await call("/placar_tasks?on_conflict=id", {
          method: "POST",
          body: JSON.stringify(task),
          prefer: "resolution=merge-duplicates,return=representation",
        }),
      );
      return normalizeTask(r[0] ?? task);
    },

    async listBenchmarks() {
      return rows(await call("/placar_benchmarks?select=*&order=id.asc")).map(normalizeBenchmark);
    },
  };
}

// ---------- arquivo local (desenvolvimento) ----------

interface FileData {
  clients: Record<string, PlacarClient>;
  entries: Record<string, PlacarEntry>;
  /** Chave `<week>_<client>`. */
  rodada: Record<string, RodadaRow>;
  tasks: Record<string, PlacarTask>;
  benchmarks: Record<string, Benchmark>;
}

// Fila de escrita por arquivo, compartilhada entre chamadas do mesmo processo.
const fileQueues = new Map<string, Promise<unknown>>();

function fileStore(filePath: string): PlacarStore {
  async function read(): Promise<FileData> {
    try {
      const raw = JSON.parse(await readFile(filePath, "utf8")) as Partial<FileData>;
      return {
        clients: raw.clients ?? {},
        entries: raw.entries ?? {},
        rodada: raw.rodada ?? {},
        tasks: raw.tasks ?? {},
        benchmarks: raw.benchmarks ?? {},
      };
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") {
        return { clients: {}, entries: {}, rodada: {}, tasks: {}, benchmarks: {} };
      }
      throw e;
    }
  }

  // Escrita atômica: grava num temporário e renomeia, para uma leitura no meio
  // do polling nunca pegar o arquivo pela metade.
  function mutate<T>(fn: (d: FileData) => T): Promise<T> {
    const prev = fileQueues.get(filePath) ?? Promise.resolve();
    const run = prev.then(async () => {
      const d = await read();
      const out = fn(d);
      await mkdir(dirname(filePath), { recursive: true });
      const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
      await writeFile(tmp, JSON.stringify(d, null, 2));
      await rename(tmp, filePath);
      return out;
    });
    fileQueues.set(filePath, run.catch(() => undefined));
    return run;
  }

  return {
    kind: "file",
    where: filePath,

    async listClients() {
      const d = await read();
      return Object.values(d.clients)
        .map((c) => normalizeClient(c as unknown as Record<string, unknown>))
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    },

    async getClient(id) {
      const d = await read();
      return d.clients[id] ? normalizeClient(d.clients[id] as unknown as Record<string, unknown>) : null;
    },

    insertClient(client) {
      return mutate((d) => {
        if (d.clients[client.id]) throw new PlacarConflictError("Já existe um cliente com esse id.");
        d.clients[client.id] = client;
        return client;
      });
    },

    updateClient(id, patch) {
      return mutate((d) => {
        const cur = d.clients[id];
        if (!cur) return null;
        const next = { ...cur, ...patch, id };
        d.clients[id] = next;
        return next;
      });
    },

    seedClient(client, overwrite) {
      return mutate((d) => {
        if (d.clients[client.id] && !overwrite) return false;
        d.clients[client.id] = client;
        return true;
      });
    },

    async listEntries(fromWeek) {
      const d = await read();
      return Object.values(d.entries)
        .map((e) => normalizeEntry(e as unknown as Record<string, unknown>))
        .filter((e) => e.week >= fromWeek)
        .sort((a, b) => (a.week === b.week ? a.id.localeCompare(b.id) : a.week < b.week ? -1 : 1));
    },

    putEntry(entry) {
      return mutate((d) => {
        if (!d.clients[entry.client]) throw new Error(`Cliente ${entry.client} não existe.`);
        d.entries[entry.id] = entry;
        return entry;
      });
    },

    deleteEntry(id) {
      return mutate((d) => {
        if (!d.entries[id]) return false;
        delete d.entries[id];
        return true;
      });
    },

    async listRodada(fromWeek) {
      const d = await read();
      return Object.values(d.rodada)
        .map((r) => normalizeRodada(r as unknown as Record<string, unknown>))
        .filter((r) => r.week >= fromWeek)
        .sort((a, b) => (a.week === b.week ? a.client.localeCompare(b.client) : a.week < b.week ? -1 : 1));
    },

    insertRodada(list) {
      return mutate((d) => {
        let n = 0;
        for (const r of list) {
          const key = `${r.week}_${r.client}`;
          if (d.rodada[key]) continue;
          d.rodada[key] = r;
          n++;
        }
        return n;
      });
    },

    async listTasks() {
      const d = await read();
      return Object.values(d.tasks)
        .map((t) => normalizeTask(t as unknown as Record<string, unknown>))
        .sort((a, b) => a.created_at.localeCompare(b.created_at));
    },

    putTask(task) {
      return mutate((d) => {
        d.tasks[task.id] = task;
        return task;
      });
    },

    async listBenchmarks() {
      const d = await read();
      return Object.values(d.benchmarks)
        .map((b) => normalizeBenchmark(b as unknown as Record<string, unknown>))
        .sort((a, b) => a.id.localeCompare(b.id));
    },
  };
}

// ---------- escolha ----------

export async function getStore(): Promise<PlacarStore> {
  const url = process.env.PLACAR_SUPABASE_URL?.trim();
  const key = process.env.PLACAR_SUPABASE_SERVICE_KEY?.trim();
  if (url && key) return supabaseStore(url, key);
  if (url || key) {
    throw new Error("Placar: configure PLACAR_SUPABASE_URL e PLACAR_SUPABASE_SERVICE_KEY juntas.");
  }
  if (process.env.VERCEL) {
    throw new Error(
      "Placar sem banco: faltam PLACAR_SUPABASE_URL e PLACAR_SUPABASE_SERVICE_KEY nas variáveis da Vercel.",
    );
  }
  const filePath = process.env.PLACAR_FILE?.trim() || join(homedir(), ".cob-hub", "placar-dev.json");
  return fileStore(filePath);
}
