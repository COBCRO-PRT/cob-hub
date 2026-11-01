/**
 * Handlers HTTP da Rodada da semana (docs/placar-semana.md).
 *
 * - GET  /api/placar/semana?week=  a rodada, congelada ou em prévia
 * - POST /api/placar/tasks          cria a tarefa de um cliente vermelho
 * - POST /api/placar/rodada         fecha a rodada na mão (só o Matheus)
 * - GET  /api/placar/cron           fechamento automático de segunda (Vercel Cron)
 *
 * O proxy já barra quem não tem login, menos o cron, que confere o CRON_SECRET aqui.
 */
import { cookies } from "next/headers";
import { USER_COOKIE_NAME, readSession, type Pessoa } from "@/lib/gate-pessoa";
import { clickupConfig } from "@/lib/clickup";
import { closeWeek, ensureRedTask, needForTask, semanaSnapshot, syncTasks } from "./rodada";
import { defaultRodadaWeek } from "./rodada-rules";
import { addWeeks, isMonday, lastClosedWeek, mondayOf } from "./score";
import { getStore } from "./store";

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const fail = (status: number, error: string) => json({ ok: false, error }, status);
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function pessoa(): Promise<Pessoa | null> {
  return readSession((await cookies()).get(USER_COOKIE_NAME)?.value);
}

/** Endereço do hub para os links dentro da tarefa do ClickUp. */
function origin(request: Request) {
  const prod = process.env.VERCEL_ENV === "production" ? process.env.VERCEL_PROJECT_PRODUCTION_URL : "";
  return prod ? `https://${prod}` : new URL(request.url).origin;
}

/** Semana válida para a rodada: uma segunda até a semana atual. */
function weekParam(v: unknown): string | null {
  const w = typeof v === "string" ? v : "";
  return isMonday(w) && w <= mondayOf(new Date()) ? w : null;
}

async function body(request: Request): Promise<Record<string, unknown>> {
  try {
    const b = await request.json();
    return b && typeof b === "object" && !Array.isArray(b) ? (b as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export async function semanaGet(request: Request) {
  const who = await pessoa();
  if (!who) return fail(401, "Sessão expirada. Recarregue a página e entre de novo.");
  const raw = new URL(request.url).searchParams.get("week");
  const week = raw ? weekParam(raw) : defaultRodadaWeek();
  if (!week) return fail(400, "Semana inválida.");
  try {
    const snap = await semanaSnapshot(await getStore(), week);
    const canClose = who.role === "admin" && !snap.closed && week <= lastClosedWeek();
    return json({ ok: true, ...snap, canClose });
  } catch (e) {
    return fail(500, errMsg(e));
  }
}

export async function taskPost(request: Request) {
  if (!(await pessoa())) return fail(401, "Sessão expirada. Recarregue a página e entre de novo.");
  if (!clickupConfig()) return fail(503, "ClickUp não está configurado no servidor.");
  const b = await body(request);
  const week = weekParam(b.week);
  const client = typeof b.client === "string" ? b.client : "";
  if (!week || !client) return fail(400, "Informe o cliente e a semana.");
  try {
    const store = await getStore();
    const snap = await semanaSnapshot(store, week);
    const row = snap.rows.find((r) => r.client === client);
    if (!row) return fail(404, "Cliente fora desta rodada.");
    if (row.tone !== "bad") return fail(400, "Este cliente não está vermelho nesta rodada.");
    const [tasks, clients, entries] = await Promise.all([
      syncTasks(store, true),
      store.listClients(),
      store.listEntries(addWeeks(mondayOf(new Date()), -8)),
    ]);
    const need = needForTask(
      clients.find((c) => c.id === client),
      entries,
    );
    const result = await ensureRedTask(store, row, tasks, origin(request), need);
    return json({ ok: true, result });
  } catch (e) {
    return fail(500, errMsg(e));
  }
}

export async function rodadaPost(request: Request) {
  const who = await pessoa();
  if (!who) return fail(401, "Sessão expirada. Recarregue a página e entre de novo.");
  if (who.role !== "admin") return fail(403, "Só o Matheus fecha a rodada na mão.");
  const week = weekParam((await body(request)).week);
  if (!week || week > lastClosedWeek()) return fail(400, "Só dá para fechar rodada de semana que já terminou.");
  try {
    return json({ ok: true, ...(await closeWeek(await getStore(), week, origin(request))) });
  } catch (e) {
    return fail(500, errMsg(e));
  }
}

export async function cronGet(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return fail(401, "Não autorizado.");
  try {
    return json({ ok: true, ...(await closeWeek(await getStore(), lastClosedWeek(), origin(request))) });
  } catch (e) {
    return fail(500, errMsg(e));
  }
}
