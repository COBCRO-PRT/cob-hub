import type { Tone } from "@/lib/placar/score";
import { cn } from "@/lib/utils";
import { Metric } from "./metric";
import { Spark } from "./spark";
import { Surface } from "./surface";

/** KPI com luz de canto e o gráfico das últimas semanas embaixo (D2.4). */
export function KpiCard({
  label,
  value,
  format,
  unit,
  fraction,
  sub,
  tone,
  spark,
  className,
}: {
  label: string;
  value: number | null;
  format?: (n: number) => string;
  unit?: string;
  fraction?: string;
  sub?: string;
  tone?: Tone;
  spark?: { values: (number | null)[]; highlight?: number; tone?: Tone | "accent"; kind?: "bars" | "line"; label?: string };
  className?: string;
}) {
  return (
    <Surface light className={cn("flex flex-col justify-between gap-4 p-5", className)}>
      <Metric size="lg" label={label} value={value} format={format} unit={unit} fraction={fraction} sub={sub} tone={tone} />
      {spark && (
        <div className="flex justify-end">
          <Spark values={spark.values} highlight={spark.highlight} tone={spark.tone ?? tone ?? "accent"} kind={spark.kind} label={spark.label} />
        </div>
      )}
    </Surface>
  );
}
