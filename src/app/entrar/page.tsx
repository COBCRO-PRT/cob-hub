import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_NAME, COOKIE_MAX_AGE, safeNext, sessionToken } from "@/lib/gate";
import { Logo } from "@/components/Logo";

export const metadata = {
  title: "Entrar — COB Hub",
  robots: { index: false, follow: false },
};

async function entrar(formData: FormData) {
  "use server";

  const senha = String(formData.get("senha") ?? "");
  const destino = safeNext(formData.get("next"), "/");
  const token = await sessionToken();

  if (!token || senha !== process.env.HUB_PASSWORD) {
    redirect(`/entrar?erro=1${destino !== "/" ? `&next=${encodeURIComponent(destino)}` : ""}`);
  }

  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });

  redirect(destino);
}

export default async function Entrar({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; next?: string }>;
}) {
  const { erro, next } = await searchParams;
  const destino = safeNext(next, "/");
  const semSenhaNoServidor = !(await sessionToken());

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#07080a] px-6">
      <div className="w-full max-w-[360px]">
        <Logo className="h-5" />

        <h1 className="mt-6 text-[26px] font-bold leading-tight tracking-tight text-white">
          Menu interno
        </h1>
        <p className="mt-2 text-[14.5px] leading-relaxed text-zinc-400">
          Use a senha do time. Se não tiver, pede pro Matheus.
        </p>

        <form action={entrar} className="mt-7 flex flex-col gap-3">
          <input type="hidden" name="next" value={destino} />
          <input
            type="password"
            name="senha"
            required
            autoComplete="current-password"
            placeholder="Senha do time"
            className="w-full rounded-xl border border-white/10 bg-[#0c0e11] px-4 py-3 text-[15px] text-white outline-none transition placeholder:text-zinc-600 focus:border-[#00e5ff]"
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
            Senha errada. Tenta de novo.
          </p>
        )}

        {semSenhaNoServidor && (
          <p className="mt-4 font-mono text-[12px] leading-relaxed text-amber-400/80">
            HUB_PASSWORD não está configurada no servidor, então nada abre.
          </p>
        )}
      </div>
    </div>
  );
}
