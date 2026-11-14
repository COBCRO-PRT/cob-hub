"use client";

import { useEffect, useMemo } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Award, ChevronsUp, TrendingUp } from "lucide-react";
import { Button, Label, Metric } from "@/components/ui";
import type { SeasonLine } from "@/lib/placar/jogo";
import type { SemanaSnapshot } from "@/lib/placar/rodada";
import { TIER_LABEL } from "@/lib/placar/degrau";
import { weekLabel } from "@/lib/placar/score";
import { Podium } from "./Temporada";

const COLORS = ["#0055fe", "#34d399", "#fcd34d", "#ffffff", "#6aa0ff"]; // ds-allow: o confete tem cor própria (§4)

/** Chuva de confete. `seed` muda para disparar de novo. Some sozinha e não roda com "reduzir movimento". */
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
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[100] overflow-hidden">
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

/** Revelação da rodada fechada: título, número herói em `metric-lg`, o mesmo pódio do herói subindo, viradas e selos. Abre sozinha uma vez por navegador. */
export function Reveal({ data, onClose }: { data: SemanaSnapshot; onClose: () => void }) {
  const reduce = useReducedMotion();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const top = data.owners.slice(0, 3);
  const levels = new Map<string, SeasonLine>(data.table.map((l) => [l.owner, l]));
  const viradas = data.rows.filter((r) => r.badges.includes("virada"));
  const selos = data.rows.filter((r) => r.badges.includes("sequencia"));
  const degraus = data.rows.filter((r) => r.badges.includes("degrau"));
  const green = data.rows.filter((r) => r.tone === "good").length;
  const party = viradas.length + selos.length + degraus.length > 0 || (top[0]?.points ?? 0) > 0;
  // Com "reduzir movimento" tudo pinta de uma vez: sem atraso, sem deslocamento.
  const step = (i: number) => ({
    initial: reduce ? false : ({ opacity: 0, y: 14 } as const),
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5, delay: reduce ? 0 : 0.25 + i * 0.35 },
  });

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={`Revelação da rodada ${data.season.round ?? ""}`}
      className="fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto bg-bg/95 p-4 backdrop-blur"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {party && <Confetti seed={Date.parse(data.week) / 86400000} />}
      <div className="flex w-full max-w-[36rem] flex-col items-center gap-8 py-6 text-center">
        <motion.div {...step(0)} className="flex flex-col items-center gap-3">
          <Label>
            {data.season.name}
            {data.season.round ? ` · rodada ${data.season.round} de ${data.season.rounds}` : ""}
          </Label>
          <h2 className="type-display text-fg">Rodada fechada</h2>
          <span className="type-caption text-mute">{weekLabel(data.week)}</span>
          <Metric size="lg" value={green} unit={`de ${data.rows.length}`} label="clientes no verde" tone={green ? "good" : undefined} className="items-center" />
        </motion.div>

        {top.length > 0 && (
          <div className="w-full">
            <Podium owners={data.owners} levels={levels} delay={reduce ? 0 : 0.6} stagger={0.35} />
          </div>
        )}

        {(viradas.length > 0 || selos.length > 0 || degraus.length > 0) && (
          <motion.div {...step(4)} className="flex w-full flex-col gap-2">
            {viradas.map((r) => (
              <span key={r.client} className="flex items-center justify-center gap-2 type-body text-fg">
                <TrendingUp aria-hidden className="size-4 text-good" strokeWidth={1.75} />
                Virada: <b className="font-semibold">{r.name}</b> <span className="text-dim">({r.owner || "sem dono"})</span>
              </span>
            ))}
            {selos.map((r) => (
              <span key={r.client} className="flex items-center justify-center gap-2 type-body text-fg">
                <Award aria-hidden className="size-4 text-gold" strokeWidth={1.75} />
                Pronto para indicação: <b className="font-semibold">{r.name}</b>
              </span>
            ))}
            {degraus.map((r) => (
              <span key={r.client} className="flex items-center justify-center gap-2 type-body text-fg">
                <ChevronsUp aria-hidden className="size-4 text-good" strokeWidth={1.75} />
                Subiu de degrau: <b className="font-semibold">{r.name}</b>{" "}
                <span className="text-dim">
                  ({r.tierPrev ? `${TIER_LABEL[r.tierPrev]} para ` : ""}
                  {TIER_LABEL[r.tier]})
                </span>
              </span>
            ))}
          </motion.div>
        )}

        <motion.div {...step(5)}>
          <Button variant="primary" size="lg" autoFocus onClick={onClose}>
            Ver a rodada
          </Button>
        </motion.div>
      </div>
    </motion.div>
  );
}
