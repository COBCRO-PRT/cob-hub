"use client";

import { useSyncExternalStore } from "react";
import { Button, KpiCard, Notice, Skeleton, Surface } from "@/components/ui";
import { buildLadder } from "@/lib/placar/degrau";
import { byClient } from "@/lib/placar/jogo";
import { addWeeks, mondayOf, scoreFor, weeksBack, type Tone } from "@/lib/placar/score";
import type { PlacarSnapshot } from "@/lib/placar/types";

const WEEKS = 8;

type Series = {
  weeks: string[];
  good: number[];
  bad: number[];
  none: number[];
  /** Clientes em Prata ou Ouro na escada do benchmark, por semana. */
  top: number[];
  /** Clientes com leitura de degrau, por semana. */
  ladder: number[];
  total: number;
};

type State = { status: "loading" | "ok" | "error"; series: Series | null; error: string | null };

/** Conta, por semana, os clientes ativos em cada tom e na escada do benchmark. Só régua pura de `@/lib/placar`. */
function tally(snapshot: PlacarSnapshot, weeks: string[]): Series {
  const by = byClient(snapshot.entries);
  const active = snapshot.clients.filter((c) => c.active !== false);
  const count = (tone: Tone) => weeks.map((w) => active.filter((c) => scoreFor(c, w, by.get(c.id) ?? []).tone === tone).length);
  const ladders = weeks.map((w) => [...buildLadder(active, by, snapshot.benchmarks ?? [], w).values()]);
  return {
    weeks,
    good: count("good"),
    bad: count("bad"),
    none: count("none"),
    top: ladders.map((l) => l.filter((c) => c.tier === "prata" || c.tier === "ouro").length),
    ladder: ladders.map((l) => l.filter((c) => c.tier).length),
    total: active.length,
  };
}

const LOADING: State = { status: "loading", series: null, error: null };
let state: State = LOADING;
const listeners = new Set<() => void>();
let busy = false;

/** Lê o placar uma vez e divide entre quem assina; falha vira estado, nunca "…" eterno (§7). */
async function refresh() {
  if (busy) return;
  busy = true;
  const weeks = weeksBack(mondayOf(new Date()), WEEKS);
  // Quatro semanas a mais atrás: a nota de cada semana olha quatro semanas para trás.
  const from = addWeeks(weeks[0], -4);
  try {
    const res = await fetch(`/api/placar?from=${from}`, { cache: "no-store" });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.ok) throw new Error(body?.error ?? `O servidor respondeu ${res.status}.`);
    state = { status: "ok", series: tally(body as PlacarSnapshot, weeks), error: null };
  } catch (e) {
    state = { status: "error", series: null, error: e instanceof Error ? e.message : "Sem conexão com o hub." };
  } finally {
    busy = false;
    listeners.forEach((l) => l());
  }
}

function subscribe(l: () => void) {
  listeners.add(l);
  if (state.status === "loading") void refresh();
  return () => {
    listeners.delete(l);
  };
}

function useWeeklyTones(): State {
  return useSyncExternalStore(subscribe, () => state, () => LOADING);
}

function retry() {
  state = LOADING;
  listeners.forEach((l) => l());
  void refresh();
}

const last = (a: number[]) => a[a.length - 1] ?? 0;

/** Linha 2 do Início (D2.5): verdes, vermelhos, sem leitura e Prata ou Ouro, com as últimas 8 semanas em barras. */
export function HomeKpis() {
  const { status, series, error } = useWeeklyTones();

  if (status === "error") {
    return (
      <div className="col-span-12">
        <Notice tone="bad" action={<Button size="sm" variant="danger" onClick={retry}>Tentar de novo</Button>}>
          Não deu para ler o placar das últimas semanas. {error}
        </Notice>
      </div>
    );
  }

  if (!series) {
    return (
      <>
        {[0, 1, 2, 3].map((i) => (
          <Surface key={i} light className="col-span-12 flex flex-col gap-4 p-5 sm:col-span-6 lg:col-span-3">
            <Skeleton className="w-20" />
            <Skeleton shape="metric" />
          </Surface>
        ))}
      </>
    );
  }

  const hi = WEEKS - 1;
  const sub = `de ${series.total} clientes ativos`;
  return (
    <>
      <KpiCard
        label="No verde"
        value={last(series.good)}
        sub={sub}
        tone="good"
        spark={{ values: series.good, highlight: hi, tone: "good", label: "Clientes no verde nas últimas 8 semanas" }}
        className="col-span-12 sm:col-span-6 lg:col-span-3"
      />
      <KpiCard
        label="No vermelho"
        value={last(series.bad)}
        sub={sub}
        tone="bad"
        spark={{ values: series.bad, highlight: hi, tone: "bad", label: "Clientes no vermelho nas últimas 8 semanas" }}
        className="col-span-12 sm:col-span-6 lg:col-span-3"
      />
      <KpiCard
        label="Sem leitura"
        value={last(series.none)}
        sub="sem número lançado"
        spark={{ values: series.none, label: "Clientes sem leitura nas últimas 8 semanas" }}
        className="col-span-12 sm:col-span-6 lg:col-span-3"
      />
      <KpiCard
        label="Em Prata ou Ouro"
        value={last(series.top)}
        unit={`de ${last(series.ladder)}`}
        sub={last(series.ladder) ? "com leitura de degrau no benchmark" : "ninguém com leitura de degrau"}
        spark={{ values: series.top, highlight: hi, tone: "gold", label: "Clientes em Prata ou Ouro nas últimas 8 semanas" }}
        className="col-span-12 sm:col-span-6 lg:col-span-3"
      />
    </>
  );
}
