/**
 * Handlers HTTP do Placar, um conjunto por público.
 *
 * - "team" (/api/placar): nunca devolve `fee` e ignora `fee` em qualquer
 *   gravação. O corte é aqui no servidor, não na tela.
 * - "finance" (/financeiro/api/placar): tudo, inclusive a mensalidade.
 *
 * O proxy já barra quem não tem login. Os handlers conferem de novo os
 * cookies para a rota continuar fechada mesmo se o matcher do proxy mudar.
 */
import { cookies } from "next/headers";
import { FINANCE_COOKIE_NAME, financeToken } from "@/lib/gate-financeiro";
import { USER_COOKIE_NAME, readSession } from "@/lib/gate-pessoa";
import { addWeeks, entryId, isMonday, isNum, lastClosedWeek, slug } from "./score";
import { getStore, PlacarConflictError } from "./store";
import type { Audience, BoardClient, PlacarClient, PlacarEntry, PlacarSnapshot } from "./types";

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

const fail = (status: number, error: string) => json({ ok: false, error }, status);

async function authorized(audience: Audience) {
  const jar = await cookies();
  const pessoa = await readSession(jar.get(USER_COOKIE_NAME)?.value);
  if (!pessoa) return false;
  if (audience === "finance") {
    if (pessoa.role !== "admin") return false;
    const fin = await financeToken();
    if (!fin || jar.get(FINANCE_COOKIE_NAME)?.value !== fin) return false;
  }
  return true;
}

function forAudience(c: PlacarClient, audience: Audience): BoardClient {
  if (audience === "finance") return c;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { fee, ...rest } = c;
  return rest;
}

async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const b = await request.json();
    return b && typeof b === "object" && !Array.isArray(b) ? (b as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

class InputError extends Error {}

// ---------- validação ----------

const text = (v: unknown, max: number, field: string) => {
  if (v === undefined || v === null) return "";
  if (typeof v !== "string") throw new InputError(`${field} precisa ser texto.`);
  const t = v.trim();
  if (t.length > max) throw new InputError(`${field} passou de ${max} caracteres.`);
  return t;
};
const bool = (v: unknown, field: string) => {
  if (typeof v !== "boolean") throw new InputError(`${field} precisa ser sim ou não.`);
  return v;
};
const numOrNull = (v: unknown, field: string, check?: (n: number) => boolean) => {
  if (v === null || v === undefined || v === "") return null;
  if (!isNum(v) || (check && !check(v))) throw new InputError(`${field} inválido.`);
  return v;
};
function pick<T extends string>(v: unknown, allowed: readonly T[], field: string): T {
  if (!allowed.includes(v as T)) throw new InputError(`${field} inválido.`);
  return v as T;
}

type ClientPatch = Partial<Omit<PlacarClient, "id">>;

/** Lê só os campos presentes. `fee` só entra para o financeiro. */
function parseClientPatch(b: Record<string, unknown>, audience: Audience): ClientPatch {
  const p: ClientPatch = {};
  if ("name" in b) {
    p.name = text(b.name, 120, "Nome");
    if (!p.name) throw new InputError("Dê um nome ao cliente.");
  }
  if ("owner" in b) p.owner = text(b.owner, 60, "Dono");
  if ("owner_ok" in b) p.owner_ok = bool(b.owner_ok, "Dono confirmado");
  if ("delivers" in b) p.delivers = text(b.delivers, 200, "O que a COB entrega");
  if ("kind" in b) p.kind = pick(b.kind, ["resultado", "projeto"] as const, "Tipo");
  if ("meta_value" in b) p.meta_value = numOrNull(b.meta_value, "Meta", (n) => n > 0);
  if ("meta_label" in b) p.meta_label = text(b.meta_label, 60, "Do quê");
  if ("meta_period" in b) p.meta_period = pick(b.meta_period, ["dia", "semana", "mes"] as const, "Período da meta");
  if ("meta_mode" in b) p.meta_mode = pick(b.meta_mode, ["soma", "taxa", "custo"] as const, "Tipo de meta");
  if ("meta_note" in b) p.meta_note = text(b.meta_note, 300, "Observação da meta");
  if ("meta_review" in b) p.meta_review = bool(b.meta_review, "Meta a revisar");
  if ("active" in b) p.active = bool(b.active, "Ativo");
  if ("sector" in b) p.sector = text(b.sector, 40, "Setor");
  if ("result_kind" in b) p.result_kind = pick(b.result_kind, ["", "lead", "conversa", "venda"] as const, "Tipo de resultado");
  if ("ads_meta" in b) p.ads_meta = text(b.ads_meta, 40, "Conta Meta").replace(/\D/g, "");
  if ("ads_google" in b) p.ads_google = text(b.ads_google, 40, "Conta Google");
  if ("budget" in b) p.budget = numOrNull(b.budget, "Verba mensal", (n) => n >= 0);
  if ("meta_auto" in b) p.meta_auto = bool(b.meta_auto, "Meta automática");
  if (audience === "finance" && "fee" in b) p.fee = numOrNull(b.fee, "Mensalidade", (n) => n >= 0);
  return p;
}

function parseEntry(b: Record<string, unknown>): PlacarEntry {
  const client = text(b.client, 80, "Cliente");
  if (!client) throw new InputError("Falta o cliente.");
  const week = text(b.week, 10, "Semana");
  if (!isMonday(week)) throw new InputError("A semana precisa ser uma segunda-feira (AAAA-MM-DD).");
  // Semana em andamento pode, semana futura não.
  if (week > addWeeks(lastClosedWeek(), 2)) throw new InputError("Essa semana ainda não chegou.");
  const weeks = b.weeks === 4 ? 4 : 1;
  const value = numOrNull(b.value, "Resultado");
  const milestone = typeof b.milestone === "boolean" ? b.milestone : null;
  const client_score = numOrNull(b.client_score, "Nota do cliente", (n) => n >= 0 && n <= 10);
  const note = text(b.note, 500, "Observação");
  if (value === null && milestone === null && client_score === null) {
    throw new InputError("Preencha o resultado, o marco ou a nota do cliente.");
  }
  return {
    id: entryId(client, week),
    client,
    week,
    weeks,
    value,
    milestone,
    client_score,
    note,
    spend: null,
    detail: {},
    source: "manual",
    updated_at: new Date().toISOString(),
  };
}

// ---------- handlers ----------

function guard(audience: Audience, fn: (request: Request) => Promise<Response>) {
  return async (request: Request) => {
    if (!(await authorized(audience))) return fail(401, "Sessão expirada. Recarregue a página e entre de novo.");
    try {
      return await fn(request);
    } catch (e) {
      if (e instanceof InputError) return fail(400, e.message);
      if (e instanceof PlacarConflictError) return fail(409, e.message);
      console.error("[placar]", e);
      return fail(500, e instanceof Error ? e.message : "Erro ao falar com o banco do placar.");
    }
  };
}

export function placarHandlers(audience: Audience) {
  /** GET ?from=AAAA-MM-DD: clientes e lançamentos a partir dessa semana. */
  const snapshot = guard(audience, async (request) => {
    const from = new URL(request.url).searchParams.get("from") ?? addWeeks(lastClosedWeek(), -12);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) throw new InputError("Parâmetro from inválido.");
    const store = await getStore();
    const [clients, entries, benchmarks] = await Promise.all([
      store.listClients(),
      store.listEntries(from),
      store.listBenchmarks(),
    ]);
    const body: PlacarSnapshot = {
      clients: clients.map((c) => forAudience(c, audience)),
      entries,
      benchmarks,
      store: store.kind,
    };
    return json({ ok: true, ...body });
  });

  /** POST: cliente novo. O id sai do nome. */
  const createClient = guard(audience, async (request) => {
    const b = await readBody(request);
    if (!b) throw new InputError("Corpo inválido.");
    const p = parseClientPatch(b, audience);
    if (!p.name) throw new InputError("Dê um nome ao cliente.");
    const store = await getStore();
    const existing = new Set((await store.listClients()).map((c) => c.id));
    let id = slug(p.name);
    for (let n = 2; existing.has(id); n++) id = `${slug(p.name)}-${n}`;
    const client: PlacarClient = {
      id,
      name: p.name,
      owner: p.owner ?? "",
      owner_ok: p.owner_ok ?? false,
      fee: audience === "finance" ? (p.fee ?? null) : null,
      delivers: p.delivers ?? "",
      kind: p.kind ?? "resultado",
      meta_value: p.meta_value ?? null,
      meta_label: p.meta_label ?? "",
      meta_period: p.meta_period ?? "mes",
      meta_mode: p.meta_mode ?? "soma",
      meta_note: p.meta_note ?? "",
      meta_review: p.meta_review ?? false,
      active: p.active ?? true,
      sector: p.sector ?? "",
      result_kind: p.result_kind ?? "",
      ads_meta: p.ads_meta ?? "",
      ads_google: p.ads_google ?? "",
      budget: p.budget ?? null,
      meta_auto: p.meta_auto ?? false,
      updated_at: new Date().toISOString(),
    };
    const saved = await store.insertClient(client);
    return json({ ok: true, client: forAudience(saved, audience) }, 201);
  });

  /** PATCH { id, ...campos }: atualiza só o que veio. */
  const updateClient = guard(audience, async (request) => {
    const b = await readBody(request);
    if (!b) throw new InputError("Corpo inválido.");
    const id = text(b.id, 80, "Cliente");
    if (!id) throw new InputError("Falta o cliente.");
    const patch = parseClientPatch(b, audience);
    const store = await getStore();
    const saved = await store.updateClient(id, { ...patch, updated_at: new Date().toISOString() });
    if (!saved) return fail(404, "Cliente não encontrado.");
    return json({ ok: true, client: forAudience(saved, audience) });
  });

  /** PUT: grava o lançamento da semana inteiro. */
  const putEntry = guard(audience, async (request) => {
    const b = await readBody(request);
    if (!b) throw new InputError("Corpo inválido.");
    const entry = parseEntry(b);
    const store = await getStore();
    if (!(await store.getClient(entry.client))) return fail(404, "Cliente não encontrado.");
    // Lançamento à mão não apaga o gasto que a leitura automática já gravou na mesma semana.
    const prev = (await store.listEntries(entry.week)).find((e) => e.id === entry.id);
    if (prev) {
      entry.spend = prev.spend;
      entry.detail = prev.detail;
    }
    const saved = await store.putEntry(entry);
    return json({ ok: true, entry: saved });
  });

  /** DELETE ?client=&week=: apaga o lançamento da semana. */
  const deleteEntry = guard(audience, async (request) => {
    const q = new URL(request.url).searchParams;
    const client = q.get("client") ?? "";
    const week = q.get("week") ?? "";
    if (!client || !isMonday(week)) throw new InputError("Cliente ou semana inválidos.");
    const store = await getStore();
    const removed = await store.deleteEntry(entryId(client, week));
    if (!removed) return fail(404, "Esse lançamento não existe mais.");
    return json({ ok: true });
  });

  return { snapshot, createClient, updateClient, putEntry, deleteEntry };
}
