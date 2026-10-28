"use client";

import { Metric } from "@/components/ui";
import type { Tone } from "@/lib/placar/score";

const real = (valor: number) =>
  valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const inteiro = (valor: number) => valor.toLocaleString("pt-BR", { maximumFractionDigits: 0 });

/**
 * `Metric` recebe a função de formato por prop, e função não atravessa a
 * fronteira servidor/cliente. Este embrulho escolhe o formato aqui dentro.
 */
export function Kpi({
  value,
  label,
  sub,
  tone,
  money = false,
}: {
  value: number;
  label: string;
  sub?: string;
  tone?: Tone;
  money?: boolean;
}) {
  return <Metric value={value} format={money ? real : inteiro} label={label} sub={sub} tone={tone} />;
}
