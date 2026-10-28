import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COOKIE_NAME, sessionToken } from "@/lib/gate";
import { FINANCE_COOKIE_NAME, financeToken } from "@/lib/gate-financeiro";
import { USER_COOKIE_NAME, readSession } from "@/lib/gate-pessoa";

/**
 * O hub mapeia todos os acessos internos, então nada abre sem senha.
 *
 * - Menu de atalhos: senha do time (HUB_PASSWORD) ou o login individual.
 * - Placar: só o login individual (HUB_USERS). A senha do time não abre.
 * - /financeiro: login de quem é "admin" e, por cima, a senha do financeiro,
 *   porque lá dentro se emite nota fiscal.
 *
 * Sem as variáveis configuradas cada porta fecha, nunca abre.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/entrar") || pathname.startsWith("/placar/entrar")) {
    return NextResponse.next();
  }

  // O cron da Vercel não tem login; a rota confere o CRON_SECRET sozinha.
  if (pathname === "/api/placar/cron") {
    return NextResponse.next();
  }

  // Chamada de API sem sessão leva 401 em JSON. Redirecionar para a tela de
  // login faria o fetch da página receber HTML no lugar dos dados.
  const isApi = pathname.startsWith("/api/") || pathname.startsWith("/financeiro/api/");
  const deny = (login: string) => {
    if (isApi) {
      return NextResponse.json({ ok: false, error: "Sessão expirada. Recarregue a página e entre de novo." }, { status: 401 });
    }
    const url = new URL(login, request.url);
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  };

  const pessoa = await readSession(request.cookies.get(USER_COOKIE_NAME)?.value);

  const isPlacar =
    pathname === "/placar" ||
    pathname.startsWith("/placar/") ||
    pathname === "/api/placar" ||
    pathname.startsWith("/api/placar/");
  const isFinanceiro = pathname === "/financeiro" || pathname.startsWith("/financeiro/");

  if (isPlacar || isFinanceiro) {
    if (!pessoa) return deny("/placar/entrar");

    if (isFinanceiro) {
      if (pessoa.role !== "admin") {
        if (isApi) return NextResponse.json({ ok: false, error: "Sem acesso ao financeiro." }, { status: 403 });
        return NextResponse.redirect(new URL("/placar", request.url));
      }

      // A porta do financeiro fica atrás do login, nunca no lugar dele.
      if (!pathname.startsWith("/financeiro/entrar")) {
        const tokenFinanceiro = await financeToken();
        const cookieFinanceiro = request.cookies.get(FINANCE_COOKIE_NAME)?.value;

        if (!tokenFinanceiro || cookieFinanceiro !== tokenFinanceiro) {
          return deny("/financeiro/entrar");
        }
      }
    }

    return NextResponse.next();
  }

  if (pessoa) return NextResponse.next();

  const token = await sessionToken();
  const cookie = request.cookies.get(COOKIE_NAME)?.value;

  if (!token || cookie !== token) {
    return deny("/entrar");
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
