import { PlacarBoard } from "@/components/placar/PlacarBoard";

export const metadata = {
  title: "Placar de Clientes · COB Hub",
  robots: { index: false, follow: false },
};

/** Visão do time: nota, meta e resultado. Nenhum valor em reais sai do servidor para cá. */
export default function PlacarTime() {
  return <PlacarBoard audience="team" apiBase="/api/placar" />;
}
