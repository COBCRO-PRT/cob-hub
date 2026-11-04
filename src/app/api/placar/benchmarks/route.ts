// Curvas de referência (placar_benchmarks). Quem grava é a rotina mensal que lê a coorte da Meta,
// com o BENCHMARK_TOKEN no cabeçalho. GET lista, POST grava uma ou mais linhas (upsert pelo id).
import { getStore } from "@/lib/placar/store";
import { isNum } from "@/lib/placar/score";
import type { Benchmark } from "@/lib/placar/types";

export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const token = process.env.BENCHMARK_TOKEN;
  return !!token && request.headers.get("authorization") === `Bearer ${token}`;
}

const KINDS = ["lead", "conversa", "venda"] as const;
const PLATFORMS = ["meta", "google"] as const;
const num = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));

function parseRow(b: Record<string, unknown>): Benchmark {
  const sector = String(b.sector ?? "").trim();
  const result_kind = KINDS.find((k) => k === b.result_kind);
  const platform = PLATFORMS.find((p) => p === b.platform);
  if (!sector || !result_kind || !platform) throw new Error("sector, result_kind (lead|conversa|venda) e platform (meta|google) são obrigatórios.");
  const metric = b.metric === "roas" || result_kind === "venda" ? "roas" : "custo";
  const p = { p25: num(b.p25), p50: num(b.p50), p75: num(b.p75), p90: num(b.p90) };
  for (const [k, v] of Object.entries(p)) if (v !== null && !(isNum(v) && v >= 0)) throw new Error(`${k} inválido.`);
  if (p.p50 === null) throw new Error("p50 é obrigatório.");
  const captured = String(b.captured_at ?? "").slice(0, 10);
  return {
    id: `${sector}_${result_kind}_${platform}`,
    sector,
    result_kind,
    platform,
    metric,
    ...p,
    source: String(b.source ?? "").slice(0, 500),
    captured_at: /^\d{4}-\d{2}-\d{2}$/.test(captured) ? captured : new Date().toISOString().slice(0, 10),
    updated_at: new Date().toISOString(),
  };
}

/** GET: as curvas gravadas e os clientes de mídia (conta Meta, grupo), para a rotina saber o que ler. */
export async function GET(request: Request) {
  if (!authorized(request)) return Response.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  const store = await getStore();
  const [rows, clients] = await Promise.all([store.listBenchmarks(), store.listClients()]);
  const media = clients
    .filter((c) => c.active && c.kind === "resultado" && c.result_kind && c.sector && c.ads_meta)
    .map((c) => ({ id: c.id, name: c.name, sector: c.sector, result_kind: c.result_kind, ads_meta: c.ads_meta }));
  return Response.json({ ok: true, rows, clients: media });
}

export async function POST(request: Request) {
  if (!authorized(request)) return Response.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  try {
    const body = (await request.json()) as { rows?: unknown } | unknown[];
    const list = Array.isArray(body) ? body : Array.isArray(body?.rows) ? body.rows : [body];
    if (!list.length || list.length > 50) throw new Error("Mande de 1 a 50 linhas.");
    const store = await getStore();
    const saved: Benchmark[] = [];
    for (const raw of list) saved.push(await store.putBenchmark(parseRow(raw as Record<string, unknown>)));
    return Response.json({ ok: true, saved: saved.map((r) => r.id) });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
