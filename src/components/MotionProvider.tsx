"use client";

import { MotionConfig } from "motion/react";

/** Quem pede "reduzir movimento" no sistema recebe o valor final sem animação, em todo o hub. */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
