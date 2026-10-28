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
export { PlayerLevel } from "./player-level";
export { Modal } from "./modal";
export { Empty } from "./empty";
export { Notice } from "./notice";
export { Skeleton } from "./skeleton";
export { spring, ease, dur, panelIn, fade } from "./motion";

/** Contêiner único de todas as telas (§4.4): mesma margem do HUD. */
export const CONTAINER = "mx-auto w-full max-w-[1280px] px-4 pt-8 pb-24 sm:px-6 lg:px-10";
