"use client";

import { useEffect, useMemo, useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Award, Crown, TrendingUp } from "lucide-react";
import type { SemanaSnapshot } from "@/lib/placar/rodada";
import { weekLabel } from "@/lib/placar/score";
import { btnPrimary } from "../tones";
import { CountUp } from "./comum";

const COLORS = ["#00e5ff", "#34d399", "#fcd34d", "#ffffff", "#7ff2ff"];

/** Chuva de confete. `seed` muda para disparar de novo. Some sozinha. */
export function Confetti({ seed, pieces = 90 }: { seed: number; pieces?: number }) {
  const reduce = useReducedMotion();
  const bits = useMemo(() => {
    // Pseudoaleatório pelo seed, para o mesmo disparo não mudar a cada render.
    const rnd = (i: number, k: number) => {
      const v = Math.sin(seed * 12.9898 + i * 78.233 + k * 37.719) * 43758.5453;
      return v - Math.floor(v);
    };
    return Array.from({ length: pieces }, (_, i) => ({
      i,
      left: rnd(i, 1) * 100,
      drift: (rnd(i, 2) - 0.5) * 220,
      spin: (rnd(i, 3) - 0.5) * 900,
      delay: rnd(i, 4) * 0.5,
      dur: 2.2 + rnd(i, 5) * 1.6,
      w: 6 + rnd(i, 6) * 6,
      h: 8 + rnd(i, 7) * 8,
      color: COLORS[Math.floor(rnd(i, 8) * COLORS.length)],
    }));
  }, [seed, pieces]);
  if (reduce || !seed) return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
      {bits.map((b) => (
        <motion.span
          key={`${seed}_${b.i}`}
          className="absolute top-0 block rounded-[2px]"
          style={{ left: `${b.left}%`, width: b.w, height: b.h, background: b.color }}
          initial={{ y: -40, x: 0, rotate: 0, opacity: 1 }}
          animate={{ y: "105vh", x: b.drift, rotate: b.spin, opacity: [1, 1, 0.9, 0] }}
          transition={{ duration: b.dur, delay: b.delay, ease: [0.2, 0.6, 0.4, 1] }}
        />
      ))}
    </div>
  );
}

/** Revelação da rodada fechada: pódio subindo, viradas e selos. Abre sozinha uma vez por navegador. */
export function Reveal({ data, onClose }: { data: SemanaSnapshot; onClose: () => void }) {
  const reduce = useReducedMotion();
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    btn.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const top = data.owners.slice(0, 3);
  const order = [top[1], top[0], top[2]].filter(Boolean);
  const viradas = data.rows.filter((r) => r.badges.includes("virada"));
  const selos = data.rows.filter((r) => r.badges.includes("sequencia"));
  const green = data.rows.filter((r) => r.tone === "good").length;
  const party = viradas.length + selos.length > 0 || (top[0]?.points ?? 0) > 0;
  const step = (i: number) => ({
    initial: reduce ? false : ({ opacity: 0, y: 14 } as const),
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5, delay: reduce ? 0 : 0.25 + i * 0.35 },
  });
  const heights = ["h-32", "h-24", "h-16"];

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={`Revelação da rodada ${data.season.round ?? ""}`}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#07080a]/96 p-4 backdrop-blur"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {party && <Confetti seed={Date.parse(data.week) / 86400000} />}
      <div className="flex w-full max-w-[560px] flex-col items-center gap-6 py-6 text-center">
        <motion.div {...step(0)} className="flex flex-col items-center gap-2">
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#00e5ff]">
            {data.season.name}
            {data.season.round ? ` · rodada ${data.season.round} de ${data.season.rounds}` : ""}
          </span>
          <h2 className="text-[clamp(28px,6vw,44px)] font-extrabold leading-none tracking-[-0.03em] text-white">Rodada fechada</h2>
          <span className="text-[13.5px] text-zinc-400">
            {weekLabel(data.week)} · {green} de {data.rows.length} clientes no verde
          </span>
        </motion.div>

        {order.length > 0 && (
          <div className="flex w-full items-end justify-center gap-3">
            {order.map((o) => {
              const pos = data.owners.indexOf(o);
              const lead = pos === 0 && o.points > 0;
              return (
                <div key={o.owner} className="flex w-[30%] flex-col items-center gap-2">
                  <motion.span {...step(3 - pos)} className="flex flex-col items-center">
                    {lead && <Crown aria-hidden className="mb-0.5 size-6 text-[#00e5ff]" />}
                    <span className="text-[16px] font-semibold text-white">{o.owner}</span>
                  </motion.span>
                  <motion.span
                    className={`flex w-full flex-col items-center rounded-t-xl border border-b-0 pt-3 ${heights[pos]} ${lead ? "border-[#00e5ff]/60 bg-[#00e5ff]/[0.12]" : "border-white/10 bg-white/[0.04]"}`}
                    style={{ originY: 1 }}
                    initial={reduce ? false : { scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{ duration: 0.7, delay: reduce ? 0 : 0.25 + (3 - pos) * 0.35, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <span className="font-mono text-[28px] font-semibold leading-none tabular-nums text-white">
                      <CountUp value={o.xp} delay={250 + (3 - pos) * 350} ms={1100} />
                    </span>
                    <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-zinc-500">XP · {pos + 1}º</span>
                  </motion.span>
                </div>
              );
            })}
          </div>
        )}

        {(viradas.length > 0 || selos.length > 0) && (
          <motion.div {...step(4)} className="flex w-full flex-col gap-2">
            {viradas.map((r) => (
              <span key={r.client} className="flex items-center justify-center gap-2 text-[14px] text-white">
                <TrendingUp aria-hidden className="size-4 text-emerald-300" />
                Virada: <b className="font-semibold">{r.name}</b> <span className="text-zinc-500">({r.owner || "sem dono"})</span>
              </span>
            ))}
            {selos.map((r) => (
              <span key={r.client} className="flex items-center justify-center gap-2 text-[14px] text-white">
                <Award aria-hidden className="size-4 text-[#00e5ff]" />
                Pronto para indicação: <b className="font-semibold">{r.name}</b>
              </span>
            ))}
          </motion.div>
        )}

        <motion.div {...step(5)}>
          <button ref={btn} type="button" onClick={onClose} className={`${btnPrimary} h-11 px-6 text-[14px]`}>
            Ver a rodada
          </button>
        </motion.div>
      </div>
    </motion.div>
  );
}
