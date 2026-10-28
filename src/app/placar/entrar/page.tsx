import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { safeNext } from "@/lib/gate";
import { USER_COOKIE_MAX_AGE, USER_COOKIE_NAME, checkLogin, createSession, loginConfigured } from "@/lib/gate-pessoa";
import { Logo } from "@/components/Logo";

export const metadata = {
  title: "Entrar no Placar · COB Hub",
  robots: { index: false, follow: false },
};

const field =
  "w-full rounded-xl border border-white/10 bg-[#0c0e11] px-4 py-3 text-[15px] text-white outline-none transition placeholder:text-zinc-600 focus:border-[#00e5ff]";

async function entrar(formData: FormData) {
  "use server";

  const nome = String(formData.get("nome") ?? "");
  const senha = String(formData.get("senha") ?? "");
  const destino = safeNext(formData.get("next"), "/placar");

  const pessoa = await checkLogin(nome, senha);
  const valor = pessoa ? await createSession(pessoa) : null;

  if (!pessoa || !valor) {
    redirect(`/placar/entrar?erro=1${destino !== "/placar" ? `&next=${encodeURIComponent(destino)}` : ""}`);
  }

  const jar = await cookies();
  jar.set(USER_COOKIE_NAME, valor, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: USER_COOKIE_MAX_AGE,
  });

  redirect(destino);
}

export default async function EntrarPlacar({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; next?: string }>;
}) {
  const { erro, next } = await searchParams;
  const destino = safeNext(next, "/placar");

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#07080a] px-6">
      <div className="w-full max-w-[360px]">
        <Logo className="h-5" />

        <h1 className="mt-6 text-[26px] font-bold leading-tight tracking-tight text-white">
          Placar de Clientes
        </h1>
        <p className="mt-2 text-[14.5px] leading-relaxed text-zinc-400">
          Cada pessoa entra com o próprio nome e senha. Se não tiver acesso, pede pro Matheus.
        </p>

        <form action={entrar} className="mt-7 flex flex-col gap-3">
          <input type="hidden" name="next" value={destino} />
          <input
            type="text"
            name="nome"
            required
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="Seu nome"
            className={field}
          />
          <input
            type="password"
            name="senha"
            required
            autoComplete="current-password"
            placeholder="Sua senha"
            className={field}
          />
          <button
            type="submit"
            className="w-full rounded-full bg-[#00e5ff] px-4 py-3 text-[15px] font-semibold text-[#04141a] transition hover:bg-[#00b4d8]"
          >
            Entrar
          </button>
        </form>

        {erro && (
          <p className="mt-4 font-mono text-[12px] text-red-400">
            Nome ou senha errados. Tenta de novo.
          </p>
        )}

        {!loginConfigured() && (
          <p className="mt-4 font-mono text-[12px] leading-relaxed text-amber-400/80">
            HUB_USERS ou HUB_SESSION_SECRET não está configurada no servidor, então o placar fica fechado.
          </p>
        )}
      </div>
    </div>
  );
}
