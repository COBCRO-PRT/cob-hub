/** Tokens de movimento (docs/design-system.md §4.5). Uma mola, duas curvas, três durações. */
export const spring = { type: "spring", stiffness: 380, damping: 32 } as const;

type Bezier = [number, number, number, number];
export const ease: { std: Bezier; quint: Bezier } = {
  std: [0.32, 0.72, 0, 1],
  quint: [0.22, 1, 0.36, 1],
};

export const dur = { fast: 0.12, base: 0.2, slow: 0.45 } as const;

/** Entrada padrão de painel (modal, folha, menu): sobe 16px com fade. */
export const panelIn = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 8 },
  transition: spring,
} as const;

/** Aparecer e sumir de texto, aviso e toast. */
export const fade = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: dur.base, ease: ease.std },
} as const;
