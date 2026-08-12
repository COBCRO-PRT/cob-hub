import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COOKIE_NAME, sessionToken } from "@/lib/gate";

/**
 * O hub mapeia todos os acessos internos, então nada abre sem a senha do time.
 * Sem HUB_PASSWORD configurada o gate fecha, nunca abre.
 */
export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/entrar")) {
    return NextResponse.next();
  }

  const token = await sessionToken();
  const cookie = request.cookies.get(COOKIE_NAME)?.value;

  if (!token || cookie !== token) {
    return NextResponse.redirect(new URL("/entrar", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
