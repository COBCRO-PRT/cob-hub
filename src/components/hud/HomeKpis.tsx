"use client";

import { useSyncExternalStore } from "react";
import { Button, KpiCard, Notice, Skeleton, Surface } from "@/components/ui";
import { addWeeks, mondayOf, scoreFor, weeksBack, type Tone } from "@/lib/placar/score";
import type { PlacarEntry, PlacarSnapshot } from "@/lib/placar/types";

const WEEKS = 8;

type Series = { weeks: string[]; good: number[]; bad: number[]; none: number[]; total: number };

type State = { status: "loading" | "ok" | "error"; series: Series | null; error: string | null };

/** Conta, por semana, os clientes ativos em cada tom. Só régua pura de `@/lib/placar/score`. */
function tally(snapshot: PlacarSnapshot, weeks: string[]): Series {
  const by = new Map<string, PlacarEntry[]>();
  for (const e of snapshot.entries) {
    const list = by.get(e.client);
    if (list) list.push(e);
    else by.set(e.client, [e]);
  }
  const active = snapshot.clients.filter((c) => c.active !== false);
  const count = (tone: Tone) => weeks.map((w) => active.filter((c) => scoreFor(c, w, by.get(c.id) ?? []).tone === tone).length);
  return { weeks, good: count("good"), bad: count("bad"), none: count("none"), total: active.length };
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

/** Linha 2 do Início (D2.5): verdes, vermelhos e sem leitura, com as últimas 8 semanas em barras. */
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
        {[0, 1, 2].map((i) => (
          <Surface key={i} light className="col-span-12 flex flex-col gap-4 p-5 md:col-span-4">
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
        className="col-span-12 md:col-span-4"
      />
      <KpiCard
        label="No vermelho"
        value={last(series.bad)}
        sub={sub}
        tone="bad"
        spark={{ values: series.bad, highlight: hi, tone: "bad", label: "Clientes no vermelho nas últimas 8 semanas" }}
        className="col-span-12 md:col-span-4"
      />
      <KpiCard
        label="Sem leitura"
        value={last(series.none)}
        sub="sem número lançado"
        spark={{ values: series.none, label: "Clientes sem leitura nas últimas 8 semanas" }}
        className="col-span-12 md:col-span-4"
      />
    </>
  );
}
