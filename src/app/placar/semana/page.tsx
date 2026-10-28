import { cookies } from "next/headers";
import { SemanaBoard } from "@/components/placar/SemanaBoard";
import { USER_COOKIE_NAME, readSession } from "@/lib/gate-pessoa";

export const metadata = {
  title: "Rodada da semana · COB Hub",
  robots: { index: false, follow: false },
};

/** Abre a reunião de segunda: meta do time, ranking dos donos e os vermelhos com tarefa. */
export default async function RodadaDaSemana() {
  const pessoa = await readSession((await cookies()).get(USER_COOKIE_NAME)?.value);
  return <SemanaBoard who={pessoa?.name} admin={pessoa?.role === "admin"} />;
}
