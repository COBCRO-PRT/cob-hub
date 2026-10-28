import { NextResponse } from "next/server";
import { USER_COOKIE_NAME } from "@/lib/gate-pessoa";
import { FINANCE_COOKIE_NAME } from "@/lib/gate-financeiro";

/** Sai do placar e do financeiro. POST, para um link solto não deslogar ninguém. */
export async function POST(request: Request) {
  const res = NextResponse.redirect(new URL("/placar/entrar", request.url), 303);
  res.cookies.set(USER_COOKIE_NAME, "", { path: "/", maxAge: 0 });
  res.cookies.set(FINANCE_COOKIE_NAME, "", { path: "/financeiro", maxAge: 0 });
  return res;
}
