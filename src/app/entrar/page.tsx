import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_NAME, COOKIE_MAX_AGE, safeNext, sessionToken } from "@/lib/gate";
import { LoginCard } from "@/components/LoginCard";

export const metadata = {
  title: "Entrar · Colombo Media Hub",
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
    <LoginCard
      title="Menu interno"
      text="Use a senha do time. Se não tiver, pede pro Matheus."
      fields={["password"]}
      action={entrar}
      next={destino}
      passwordLabel="Senha do time"
      error={erro ? "Senha errada. Tenta de novo." : undefined}
      notice={semSenhaNoServidor ? "HUB_PASSWORD não está configurada no servidor, então nada abre." : undefined}
    />
  );
}
