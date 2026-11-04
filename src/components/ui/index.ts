export { Button, type ButtonProps, type ButtonVariant, type ButtonSize } from "./button";
export { Field, type FieldProps } from "./field";
export { Surface, type SurfaceProps } from "./surface";
export { Label } from "./label";
export { SectionTitle } from "./section-title";
export { Kbd } from "./kbd";
export { Pill, type PillTone } from "./pill";
export { Metric, fmtNumber } from "./metric";
export { Score, fmtScore } from "./score";
export { Trail } from "./trail";
export { Bar } from "./bar";
export { Spark, type SparkTone } from "./spark";
export { Ladder, type LadderMark } from "./ladder";
export { Columns, type ColumnSeries } from "./columns";
export { KpiCard } from "./kpi-card";
export { Gauge } from "./gauge";
export { PlayerLevel } from "./player-level";
export { Modal } from "./modal";
export { Empty } from "./empty";
export { Notice } from "./notice";
export { Skeleton } from "./skeleton";
export { spring, ease, dur, panelIn, fade } from "./motion";

/** Contêiner único de todas as telas (D2.3): dentro da casca, ao lado da sidebar. */
export const CONTAINER = "mx-auto w-full max-w-[1440px] min-[1700px]:max-w-[1560px] px-4 pt-6 pb-24 sm:px-6 lg:px-8";
