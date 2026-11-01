import type { Tone } from "@/lib/placar/score";
import { cn } from "@/lib/utils";

const FILL: Record<Tone | "accent", string> = { good: "fill-good", warn: "fill-warn", bad: "fill-bad", none: "fill-none", accent: "fill-accent" };
const STROKE: Record<Tone | "accent", string> = { good: "stroke-good", warn: "stroke-warn", bad: "stroke-bad", none: "stroke-none", accent: "stroke-accent" };

const BAR = 3;
const GAP = 3;

/**
 * O gráfico de dentro do KPI (D2.4): barras finas ou linha das últimas semanas.
 * `null` é semana sem leitura (toco apagado). `highlight` acende uma barra no tom.
 */
export function Spark({
  values,
  tone = "accent",
  kind = "bars",
  highlight,
  height = 28,
  label,
  className,
}: {
  values: (number | null)[];
  tone?: Tone | "accent";
  kind?: "bars" | "line";
  highlight?: number;
  height?: number;
  /** Texto para leitor de tela; sem ele o gráfico é decorativo. */
  label?: string;
  className?: string;
}) {
  const n = values.length;
  const max = Math.max(1, ...values.map((v) => v ?? 0));
  const width = n * (BAR + GAP) - GAP;
  const h = (v: number | null) => (v === null ? 2 : Math.max(2, (v / max) * height));
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("block shrink-0 overflow-visible", className)}
    >
      {kind === "bars"
        ? values.map((v, i) => (
            <rect
              key={i}
              x={i * (BAR + GAP)}
              y={height - h(v)}
              width={BAR}
              height={h(v)}
              rx={1.5}
              className={cn(v === null ? "fill-line" : i === highlight ? FILL[tone] : "fill-line-strong")}
            />
          ))
        : (
            <polyline
              fill="none"
              strokeWidth={1.5}
              strokeLinejoin="round"
              strokeLinecap="round"
              className={STROKE[tone]}
              points={values.map((v, i) => `${i * (BAR + GAP) + BAR / 2},${height - h(v)}`).join(" ")}
            />
          )}
    </svg>
  );
}
