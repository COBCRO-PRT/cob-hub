"use client";

import { useSyncExternalStore } from "react";
import type { Jogador } from "@/lib/placar/jogador";

/**
 * Cartão do jogador (/api/placar/eu), lido uma vez e dividido entre a barra e a home.
 * Relê a cada minuto e quando a aba volta ao foco. Falha vira estado, nunca "…" eterno (§7).
 */
export type PlayerState = {
  status: "loading" | "ok" | "none" | "error";
  data: Jogador | null;
  /** Mensagem da última falha; o cartão anterior fica em `data` se houver. */
  error: string | null;
};

const LOADING: PlayerState = { status: "loading", data: null, error: null };
const NONE: PlayerState = { status: "none", data: null, error: null };

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
    if (res.ok && body?.ok) state = { status: "ok", data: body as Jogador, error: null };
    else if (res.status === 401) state = NONE;
    else state = { status: "error", data: state.data, error: body?.error ?? `O servidor respondeu ${res.status}.` };
  } catch {
    state = { status: "error", data: state.data, error: "Sem conexão com o hub." };
  } finally {
    busy = false;
    listeners.forEach((l) => l());
  }
}

const onFocus = () => document.visibilityState === "visible" && void refresh();

function subscribe(l: () => void) {
  listeners.add(l);
  if (!timer) {
    void refresh();
    timer = setInterval(refresh, 60_000);
    document.addEventListener("visibilitychange", onFocus);
  }
  return () => {
    listeners.delete(l);
    if (!listeners.size && timer) {
      clearInterval(timer);
      timer = null;
      document.removeEventListener("visibilitychange", onFocus);
    }
  };
}

const subscribeNoop = () => () => {};

/** Tenta ler o cartão de novo agora. */
export function retryPlayer() {
  void refresh();
}

/** `enabled` = tem login individual; sem ele nem pergunta ao servidor. */
export function usePlayer(enabled: boolean): PlayerState {
  return useSyncExternalStore(
    enabled ? subscribe : subscribeNoop,
    () => (enabled ? state : NONE),
    () => (enabled ? LOADING : NONE),
  );
}
