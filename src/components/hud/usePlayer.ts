"use client";

import { useSyncExternalStore } from "react";
import type { Jogador } from "@/lib/placar/jogador";

/**
 * Cartão do jogador (/api/placar/eu), lido uma vez e dividido entre a barra e a home.
 * Relê a cada minuto enquanto alguém na página estiver olhando.
 */
export type PlayerState = { status: "loading" | "ok" | "none"; data: Jogador | null };

const LOADING: PlayerState = { status: "loading", data: null };
const NONE: PlayerState = { status: "none", data: null };

let state: PlayerState = LOADING;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;
let busy = false;

async function refresh() {
  if (busy) return;
  busy = true;
  try {
    const res = await fetch("/api/placar/eu", { cache: "no-store" });
    const body = await res.json().catch(() => null);
    state = res.ok && body?.ok ? { status: "ok", data: body as Jogador } : NONE;
  } catch {
    // Sem rede: fica o último cartão lido.
    if (state.status === "loading") state = NONE;
  } finally {
    busy = false;
    listeners.forEach((l) => l());
  }
}

function subscribe(l: () => void) {
  listeners.add(l);
  if (!timer) {
    void refresh();
    timer = setInterval(refresh, 60_000);
  }
  return () => {
    listeners.delete(l);
    if (!listeners.size && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

const subscribeNoop = () => () => {};

/** `enabled` = tem login individual; sem ele nem pergunta ao servidor. */
export function usePlayer(enabled: boolean): PlayerState {
  const s = useSyncExternalStore(
    enabled ? subscribe : subscribeNoop,
    () => (enabled ? state : NONE),
    () => (enabled ? LOADING : NONE),
  );
  return s;
}
