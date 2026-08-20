import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  FINANCE_COOKIE_NAME,
  FINANCE_COOKIE_MAX_AGE,
  financeToken,
} from "@/lib/gate-financeiro";

export const metadata = {
  title: "Financeiro — COB Hub",
  robots: { index: false, follow: false },
};

async function entrar(formData: FormData) {
  "use server";

  const senha = String(formData.get("senha") ?? "");
  const token = await financeToken();

  if (!token || senha !== process.env.HUB_FINANCE_PASSWORD) {
    redirect("/financeiro/entrar?erro=1");
  }

  const jar = await cookies();
  jar.set(FINANCE_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/financeiro",
    maxAge: FINANCE_COOKIE_MAX_AGE,
  });

  redirect("/financeiro/notas");
}

export default async function EntrarFinanceiro({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;
  const semSenhaNoServidor = !(await financeToken());

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] px-6">
      <div className="w-full max-w-[360px]">
        <span className="text-[22px] font-extrabold tracking-[-0.03em] text-white">
          CO-B<span className="text-[#c0de1b]">.</span>
        </span>

        <h1 className="mt-6 text-[26px] font-bold leading-tight tracking-tight text-white">
          Financeiro
        </h1>
        <p className="mt-2 text-[14.5px] leading-relaxed text-zinc-400">
          Aqui se emite nota fiscal, então a senha é outra. A sessão cai em 12 horas.
        </p>

        <form action={entrar} className="mt-7 flex flex-col gap-3">
          <input
            type="password"
            name="senha"
            required
            autoComplete="current-password"
            placeholder="Senha do financeiro"
            className="w-full rounded-xl border border-white/10 bg-[#141414] px-4 py-3 text-[15px] text-white outline-none transition placeholder:text-zinc-600 focus:border-[#c0de1b]"
          />
          <button
            type="submit"
            className="w-full rounded-xl bg-[#c0de1b] px-4 py-3 text-[15px] font-semibold text-[#0a0a0a] transition hover:brightness-110"
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
            HUB_FINANCE_PASSWORD não está configurada no servidor, então a área fica fechada.
          </p>
        )}
      </div>
    </div>
  );
}
