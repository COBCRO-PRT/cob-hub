// Meta automática pela escada, todo dia 1 (vercel.json). Confere o CRON_SECRET; ?dry=1 só calcula.
import { getStore } from "@/lib/placar/store";
import { refreshAutoMetas } from "@/lib/placar/metas";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }
  try {
    const dry = new URL(request.url).searchParams.get("dry") === "1";
    return Response.json({ ok: true, dry, ...(await refreshAutoMetas(await getStore(), dry)) });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
