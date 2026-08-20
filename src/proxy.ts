import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COOKIE_NAME, sessionToken } from "@/lib/gate";
import { FINANCE_COOKIE_NAME, financeToken } from "@/lib/gate-financeiro";

/**
 * O hub mapeia todos os acessos internos, então nada abre sem a senha do time.
 * Sem HUB_PASSWORD configurada o gate fecha, nunca abre.
 *
 * A área /financeiro pede uma segunda senha por cima dessa, porque lá dentro
 * se emite nota fiscal.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/entrar")) {
    return NextResponse.next();
  }

  const token = await sessionToken();
  const cookie = request.cookies.get(COOKIE_NAME)?.value;

  if (!token || cookie !== token) {
    return NextResponse.redirect(new URL("/entrar", request.url));
  }

  // A porta do financeiro fica atrás da porta do time, nunca no lugar dela.
  if (pathname.startsWith("/financeiro") && !pathname.startsWith("/financeiro/entrar")) {
    const tokenFinanceiro = await financeToken();
    const cookieFinanceiro = request.cookies.get(FINANCE_COOKIE_NAME)?.value;

    if (!tokenFinanceiro || cookieFinanceiro !== tokenFinanceiro) {
      return NextResponse.redirect(new URL("/financeiro/entrar", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
