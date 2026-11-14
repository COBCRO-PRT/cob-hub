import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { safeNext } from "@/lib/gate";
import { USER_COOKIE_NAME, readSession } from "@/lib/gate-pessoa";
import { LoginCard } from "@/components/LoginCard";
import {
  FINANCE_COOKIE_NAME,
  FINANCE_COOKIE_MAX_AGE,
  financeToken,
} from "@/lib/gate-financeiro";

export const metadata = {
  title: "Financeiro · Colombo Media Hub",
  robots: { index: false, follow: false },
};

async function entrar(formData: FormData) {
  "use server";

  const senha = String(formData.get("senha") ?? "");
  const destino = safeNext(formData.get("next"), "/financeiro/notas", "/financeiro/");
  const token = await financeToken();
  const jar = await cookies();
  const pessoa = await readSession(jar.get(USER_COOKIE_NAME)?.value);

  // A action é endpoint HTTP: confere o login aqui também, não só no proxy.
  if (pessoa?.role !== "admin") {
    redirect("/placar/entrar");
  }

  if (!token || senha !== process.env.HUB_FINANCE_PASSWORD) {
    redirect(`/financeiro/entrar?erro=1&next=${encodeURIComponent(destino)}`);
  }

  jar.set(FINANCE_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/financeiro",
    maxAge: FINANCE_COOKIE_MAX_AGE,
  });

  redirect(destino);
}

export default async function EntrarFinanceiro({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; next?: string }>;
}) {
  const { erro, next } = await searchParams;
  const destino = safeNext(next, "/financeiro/notas", "/financeiro/");
  const semSenhaNoServidor = !(await financeToken());

  return (
    <LoginCard
      title="Financeiro"
      text="Aqui se emite nota fiscal, então a senha é outra. A sessão cai em 12 horas."
      fields={["password"]}
      action={entrar}
      next={destino}
      passwordLabel="Senha do financeiro"
      error={erro ? "Senha errada. Tenta de novo." : undefined}
      notice={
        semSenhaNoServidor
          ? "HUB_FINANCE_PASSWORD não está configurada no servidor, então a área fica fechada."
          : undefined
      }
    />
  );
}
