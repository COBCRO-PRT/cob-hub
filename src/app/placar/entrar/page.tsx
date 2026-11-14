import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { safeNext } from "@/lib/gate";
import { USER_COOKIE_MAX_AGE, USER_COOKIE_NAME, checkLogin, createSession, loginConfigured } from "@/lib/gate-pessoa";
import { LoginCard } from "@/components/LoginCard";

export const metadata = {
  title: "Entrar no Placar · Colombo Media Hub",
  robots: { index: false, follow: false },
};

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
    <LoginCard
      title="Placar de Clientes"
      text="Cada pessoa entra com o próprio nome e senha. Se não tiver acesso, pede pro Matheus."
      fields={["name", "password"]}
      action={entrar}
      next={destino}
      passwordLabel="Sua senha"
      error={erro ? "Nome ou senha errados. Tenta de novo." : undefined}
      notice={
        loginConfigured()
          ? undefined
          : "HUB_USERS ou HUB_SESSION_SECRET não está configurada no servidor, então o placar fica fechado."
      }
    />
  );
}
