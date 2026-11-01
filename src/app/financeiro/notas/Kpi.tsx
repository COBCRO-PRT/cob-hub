"use client";

import { KpiCard } from "@/components/ui";
import type { Tone } from "@/lib/placar/score";

/** Parte inteira em reais; os centavos vão apagados na `fraction` (D2.4). */
const reaisInteiros = (valor: number) =>
  Math.floor(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const inteiro = (valor: number) => valor.toLocaleString("pt-BR", { maximumFractionDigits: 0 });

/**
 * `KpiCard` recebe a função de formato por prop, e função não atravessa a
 * fronteira servidor/cliente. Este embrulho escolhe o formato aqui dentro.
 */
export function Kpi({
  value,
  label,
  sub,
  tone,
  money = false,
  className,
}: {
  value: number;
  label: string;
  sub?: string;
  tone?: Tone;
  money?: boolean;
  className?: string;
}) {
  if (money) {
    const centavos = Math.round(value * 100) % 100;
    return (
      <KpiCard
        label={label}
        value={Math.floor(value)}
        format={reaisInteiros}
        fraction={`,${String(centavos).padStart(2, "0")}`}
        sub={sub}
        tone={tone}
        className={className}
      />
    );
  }
  return <KpiCard label={label} value={value} format={inteiro} sub={sub} tone={tone} className={className} />;
}
