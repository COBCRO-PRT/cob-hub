/**
 * Handlers do pedido do cliente (docs/placar-pedido-cliente.md).
 *
 * - PUT  /api/placar/pedido   o cliente responde, sem login; o código do link é a chave
 * - POST /api/placar/pedido   o dono responde ao pedido (aceita como meta ou mantém a régua); exige login
 *
 * O proxy libera a rota; cada handler confere o que lhe cabe.
 */
import { cookies } from "next/headers";
import { USER_COOKIE_NAME, readSession } from "@/lib/gate-pessoa";
import { nextMonth, pedidoCode, pedidoId, unitOf } from "./pedido";
import { entryId, lastClosedWeek } from "./score";
import { autoMetaNow } from "./metas";
import { getStore } from "./store";
import type { PlacarEntry, PlacarPedido } from "./types";

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const fail = (status: number, error: string) => json({ ok: false, error }, status);

async function body(request: Request): Promise<Record<string, unknown>> {
  try {
    const b = await request.json();
    return b && typeof b === "object" && !Array.isArray(b) ? (b as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

const num = (v: unknown) => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
};

const nf = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** PUT: o cliente responde. Um pedido por mês; mandar de novo substitui. */
export async function pedidoPut(request: Request) {
  const b = await body(request);
  const client = text(b.client, 80);
  const code = text(b.code, 20);
  if (!client || !code) return fail(400, "Link incompleto.");
  const expected = await pedidoCode(client);
  if (!expected || expected !== code) return fail(404, "Esse link não vale mais. Fale com a Colombo Media.");

  const store = await getStore();
  const c = await store.getClient(client);
  if (!c || !c.active) return fail(404, "Esse link não vale mais. Fale com a Colombo Media.");

  const wanted = num(b.wanted_value);
  if (wanted === null || Number.isNaN(wanted) || wanted < 0) return fail(400, "Diga o resultado que você quer, em número.");
  const score = num(b.score);
  if (score === null || Number.isNaN(score) || score < 0 || score > 10) return fail(400, "A nota vai de 0 a 10.");
  const note = text(b.note, 500);

  const month = nextMonth();
  const now = new Date().toISOString();
  const pedido: PlacarPedido = {
    id: pedidoId(client, month),
    client,
    month,
    wanted_value: wanted,
    wanted_label: unitOf(c),
    score,
    note,
    created_at: now,
    answered_at: null,
    answer: "",
    accepted: false,
  };
  try {
    await store.putPedido(pedido);
    // A nota vira a nota do cliente da última semana fechada, sem apagar o número que já estava lá.
    const week = lastClosedWeek();
    const prev = (await store.listEntries(week)).find((e) => e.id === entryId(client, week));
    const entry: PlacarEntry = prev
      ? { ...prev, client_score: score, updated_at: now }
      : {
          id: entryId(client, week),
          client,
          week,
          weeks: 1,
          value: null,
          milestone: null,
          client_score: score,
          note: "Nota dada pelo cliente no pedido do mês",
          spend: null,
          detail: {},
          source: "manual",
          updated_at: now,
        };
    await store.putEntry(entry);
  } catch (e) {
    console.error("[placar/pedido]", e);
    return fail(500, "Não deu para gravar agora. Tente de novo em instantes.");
  }
  return json({ ok: true, month, owner: c.owner });
}

/**
 * POST { id, budget?, answer? }: o dono responde. Com `budget`, a verba da ficha muda e a meta é
 * recalculada na hora pela régua (o pedido nunca vira meta). Sem `budget`, a régua fica e `answer`
 * é o que o dono vai dizer ao cliente.
 */
export async function pedidoPost(request: Request) {
  const who = await readSession((await cookies()).get(USER_COOKIE_NAME)?.value);
  if (!who) return fail(401, "Sessão expirada. Recarregue a página e entre de novo.");
  const b = await body(request);
  const id = text(b.id, 120);
  const budget = num(b.budget);
  const answer = text(b.answer, 500);
  if (!id) return fail(400, "Falta o pedido.");
  if (budget !== null && (Number.isNaN(budget) || budget <= 0)) return fail(400, "A verba precisa ser um número maior que zero.");
  if (budget === null && !answer) return fail(400, "Escreva o que você vai responder ao cliente.");

  const store = await getStore();
  const pedido = (await store.listPedidos("2000-01")).find((p) => p.id === id);
  if (!pedido) return fail(404, "Pedido não encontrado.");
  const c = await store.getClient(pedido.client);
  if (!c) return fail(404, "Cliente não encontrado.");

  const now = new Date().toISOString();
  try {
    let text_ = answer;
    if (budget !== null) {
      await store.updateClient(c.id, { budget, meta_auto: true, updated_at: now });
      const m = await autoMetaNow(store, c.id);
      if (!m) return fail(400, "Esse cliente não entra na régua (sem setor, tipo de resultado ou leitura). Responda ao cliente em texto.");
      text_ = `Verba ajustada para R$ ${nf.format(budget)}. Meta pela régua: ${nf.format(m.to)} ${c.meta_label || ""}`.trim();
    }
    const saved = await store.putPedido({ ...pedido, accepted: budget !== null, answer: text_, answered_at: now });
    return json({ ok: true, pedido: saved });
  } catch (e) {
    console.error("[placar/pedido]", e);
    return fail(500, e instanceof Error ? e.message : "Erro ao gravar a resposta.");
  }
}
