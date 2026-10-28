import { PlacarBoard } from "@/components/placar/PlacarBoard";

export const metadata = {
  title: "Placar de Clientes, financeiro · COB Hub",
  robots: { index: false, follow: false },
};

/**
 * Visão do Matheus: tudo do time mais a mensalidade de cada cliente e quanto dela
 * está no vermelho. Fica sob /financeiro para herdar a segunda senha do proxy.
 */
export default function PlacarFinanceiro() {
  return <PlacarBoard audience="finance" apiBase="/financeiro/api/placar" />;
}
