import type { Tone } from "@/lib/placar/score";

/** Cor de cada faixa. Classe inteira escrita aqui para o Tailwind enxergar. */
export const TONE_STYLE: Record<Tone, { text: string; soft: string; solid: string; label: string }> = {
  good: { text: "text-emerald-400", soft: "bg-emerald-400/12", solid: "bg-emerald-400", label: "Verde" },
  warn: { text: "text-amber-300", soft: "bg-amber-300/12", solid: "bg-amber-300", label: "Amarelo" },
  bad: { text: "text-red-400", soft: "bg-red-400/12", solid: "bg-red-400", label: "Vermelho" },
  none: { text: "text-zinc-500", soft: "bg-zinc-500/12", solid: "bg-zinc-600", label: "Cinza" },
};

export const fieldLabel = "text-[10.5px] font-medium uppercase tracking-[0.14em] text-zinc-500";

/** 16px no celular para o iPhone não dar zoom ao focar o campo. */
export const fieldInput =
  "w-full rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-[16px] text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 hover:bg-white/[0.05] focus:border-[#00e5ff]/60 sm:text-[14px]";

export const btnBase =
  "inline-flex items-center justify-center rounded-full px-4 py-1.5 text-[13px] font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00e5ff] disabled:opacity-50";
export const btnPrimary = `${btnBase} bg-[#00e5ff] font-semibold text-[#04141a] hover:bg-[#00b4d8]`;
export const btnGhost = `${btnBase} border border-white/10 text-zinc-300 hover:border-white/25 hover:text-white`;
export const btnDanger = `${btnBase} border border-red-500/30 text-red-400 hover:bg-red-500/10`;
