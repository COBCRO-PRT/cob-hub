// Cartão do jogador da barra do hub: nível, XP e missões abertas de quem está logado.
import { cookies } from "next/headers";
import { USER_COOKIE_NAME, readSession } from "@/lib/gate-pessoa";
import { jogador } from "@/lib/placar/jogador";
import { getStore } from "@/lib/placar/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const pessoa = await readSession((await cookies()).get(USER_COOKIE_NAME)?.value);
  const headers = { "Cache-Control": "no-store" };
  if (!pessoa) return Response.json({ ok: false, error: "Sem login." }, { status: 401, headers });
  try {
    const eu = await jogador(await getStore(), pessoa.name, pessoa.role === "admin");
    return Response.json({ ok: true, ...eu }, { headers });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500, headers });
  }
}
