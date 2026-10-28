"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  addWeeks,
  fmt1,
  fmt2,
  fmtBRL,
  fmtScore,
  isNum,
  lastClosedWeek,
  mean,
  metaText,
  mondayOf,
  scoreFor,
  TONE_RANK,
  toneOf,
  weekLabel,
  weeksBack,
  type Score,
  type Tone,
} from "@/lib/placar/score";
import { Trophy } from "lucide-react";
import { roundOf, SEASON } from "@/lib/placar/rodada-rules";
import type { Audience, BoardClient, PlacarEntry, PlacarSnapshot } from "@/lib/placar/types";
import { ClientDialog, EntryDialog } from "./PlacarDialogs";
import { btnGhost, btnPrimary, TONE_STYLE } from "./tones";

const OWNERS = ["Matheus", "Ramon", "Israel", "Sayuri"];
const REFRESH_MS = 30_000;
const TONES: Tone[] = ["good", "warn", "bad", "none"];

interface Row {
  c: BoardClient;
  s: Score;
  spark: (number | null)[];
}

type LoadState = "loading" | "ok" | "error" | "auth";

// Liga só depois de montar no navegador: a semana sai do relógio local, e o
// servidor da Vercel está em UTC.
const subscribeNoop = () => () => {};
const useMounted = () => useSyncExternalStore(subscribeNoop, () => true, () => false);

export function PlacarBoard({ audience, apiBase }: { audience: Audience; apiBase: string }) {
  const finance = audience === "finance";
  const mounted = useMounted();
  const [pickedWeek, setPickedWeek] = useState<string | null>(null);
  const week = pickedWeek ?? (mounted ? lastClosedWeek() : null);

  const [data, setData] = useState<PlacarSnapshot | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [owner, setOwner] = useState("__all");
  const [showInactive, setShowInactive] = useState(false);
  const [entryClient, setEntryClient] = useState<BoardClient | null>(null);
  const [clientDlg, setClientDlg] = useState<{ client: BoardClient | null } | null>(null);
  const seq = useRef(0);

  const load = useCallback(async () => {
    if (!week) return;
    const mine = ++seq.current;
    try {
      const res = await fetch(`${apiBase}?from=${addWeeks(week, -12)}`, { cache: "no-store" });
      const body = await res.json().catch(() => null);
      if (mine !== seq.current) return;
      if (res.status === 401) {
        setState("auth");
        return;
      }
      if (!res.ok || !body?.ok) {
        setErrorMsg(body?.error ?? `O servidor respondeu ${res.status}.`);
        setState("error");
        return;
      }
      setData({ clients: body.clients, entries: body.entries, store: body.store });
      setState("ok");
    } catch {
      if (mine !== seq.current) return;
      setErrorMsg("Sem conexão com o servidor.");
      setState("error");
    }
  }, [apiBase, week]);

  useEffect(() => {
    if (!week) return;
    const first = setTimeout(load, 0);
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [load, week]);

  const currentMonday = mounted ? mondayOf(new Date()) : null;
  const closed = mounted ? lastClosedWeek() : null;

  const all: Row[] = useMemo(() => {
    if (!data || !week) return [];
    const by = new Map<string, PlacarEntry[]>();
    for (const e of data.entries) {
      const list = by.get(e.client);
      if (list) list.push(e);
      else by.set(e.client, [e]);
    }
    const sparkWeeks = weeksBack(week, 8);
    return data.clients.map((c) => {
      const list = by.get(c.id) ?? [];
      return { c, s: scoreFor(c, week, list), spark: sparkWeeks.map((w) => scoreFor(c, w, list).final) };
    });
  }, [data, week]);

  const active = useMemo(() => all.filter((r) => r.c.active !== false), [all]);
  const inactiveCount = all.length - active.length;

  const ownerGroups = useMemo(() => {
    const groups = new Map<string, { name: string; rows: Row[] }>([["__all", { name: "Todos", rows: active }]]);
    const names = [...new Set([...OWNERS, ...active.map((r) => r.c.owner.trim()).filter(Boolean)])];
    for (const n of names) {
      const rs = active.filter((r) => r.c.owner.trim() === n);
      if (rs.length) groups.set(n, { name: n, rows: rs });
    }
    const noOwner = active.filter((r) => !r.c.owner.trim());
    if (noOwner.length) groups.set("__none", { name: "Sem dono", rows: noOwner });
    return groups;
  }, [active]);

  const ownerNames = useMemo(
    () => [...new Set([...OWNERS, ...all.map((r) => r.c.owner.trim()).filter(Boolean)])],
    [all],
  );

  const selectedOwner = ownerGroups.has(owner) ? owner : "__all";

  const list = useMemo(() => {
    let rows = showInactive ? all : active;
    if (selectedOwner === "__none") rows = rows.filter((r) => !r.c.owner.trim());
    else if (selectedOwner !== "__all") rows = rows.filter((r) => r.c.owner.trim() === selectedOwner);
    return [...rows].sort(
      (a, b) =>
        TONE_RANK[a.s.tone] - TONE_RANK[b.s.tone] ||
        (a.s.final ?? 99) - (b.s.final ?? 99) ||
        a.c.name.localeCompare(b.c.name, "pt-BR"),
    );
  }, [all, active, showInactive, selectedOwner]);

  const entryFor = (c: BoardClient | null) =>
    c && week && data ? data.entries.find((e) => e.id === `${c.id}_${week}`) : undefined;

  const go = (w: string) => setPickedWeek(w);

  return (
    <div className="min-h-screen bg-[#07080a]">
      <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-7 px-4 pb-24 pt-8 sm:px-6 lg:px-8">

        <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div className="flex min-w-0 flex-col gap-2">
            <span className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-500">
              <i aria-hidden className="inline-block size-2.5 rounded-[2px] bg-[#00e5ff]" />
              COB · gestão por resultado{finance ? " · visão do financeiro" : ""}
            </span>
            <h1 className="text-[clamp(26px,4vw,34px)] font-extrabold leading-none tracking-[-0.03em] text-white">
              Placar de Clientes
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2" aria-label="Semana do placar">
            <button
              type="button"
              aria-label="Semana anterior"
              disabled={!week}
              onClick={() => week && go(addWeeks(week, -1))}
              className={`${btnGhost} size-9 px-0 text-[16px]`}
            >
              ‹
            </button>
            <div className="flex min-w-[148px] flex-col items-center px-1">
              <b className="font-mono text-[15px] font-semibold tabular-nums text-white">{week ? weekLabel(week) : "…"}</b>
              <span className="text-[11.5px] text-zinc-500">
                {!week || !closed ? "semana lida" : week === closed ? "última semana fechada" : week > closed ? "semana em andamento" : "semana lida"}
              </span>
            </div>
            <button
              type="button"
              aria-label="Próxima semana"
              disabled={!week || !currentMonday || week >= currentMonday}
              onClick={() => week && go(addWeeks(week, 1))}
              className={`${btnGhost} size-9 px-0 text-[16px]`}
            >
              ›
            </button>
            <button type="button" onClick={() => setPickedWeek(null)} className={`${btnGhost} h-9`}>
              Última semana fechada
            </button>
            {!finance && (
              <Link
                href="/placar/semana"
                className={`${btnGhost} h-9 gap-1.5 border-[#00e5ff]/40 text-[#7ff2ff] hover:border-[#00e5ff] hover:text-white`}
              >
                <Trophy aria-hidden className="size-3.5" />
                Rodada da semana
                {currentMonday && roundOf(currentMonday) && (
                  <span className="font-mono text-[11.5px] text-zinc-400">
                    {roundOf(currentMonday)}/{SEASON.rounds}
                  </span>
                )}
              </Link>
            )}
            <button type="button" onClick={() => setClientDlg({ client: null })} disabled={state !== "ok"} className={`${btnPrimary} h-9`}>
              Novo cliente
            </button>
          </div>
        </header>

        {data?.store === "file" && (
          <p className="rounded-lg border border-sky-400/20 bg-sky-400/[0.05] px-4 py-2.5 font-mono text-[12px] leading-relaxed text-sky-300/90">
            Dados locais de desenvolvimento (arquivo no computador). Nada daqui chega ao time.
          </p>
        )}

        {state === "auth" && (
          <Notice tone="warn" title="Sua sessão expirou">
            Recarregue a página para entrar de novo.
          </Notice>
        )}
        {state === "error" && (
          <Notice tone="bad" title={data ? "Não deu para atualizar o placar agora" : "Não deu para ler o placar"}>
            {errorMsg} {data ? "Mostrando a última leitura. Tento de novo em 30 segundos." : "Recarregue a página em instantes."}
          </Notice>
        )}

        {!data ? (
          state === "loading" && <Empty>Carregando o placar…</Empty>
        ) : (
          <>
            <Summary rows={active} finance={finance} />

            <section aria-label="Donos" className="flex flex-col gap-3">
              <h2 className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">Donos</h2>
              <div className="flex flex-wrap gap-2">
                {[...ownerGroups.entries()].map(([key, g]) => (
                  <OwnerChip
                    key={key}
                    name={g.name}
                    rows={g.rows}
                    finance={finance}
                    pressed={selectedOwner === key}
                    onClick={() => setOwner(selectedOwner === key ? "__all" : key)}
                  />
                ))}
              </div>
            </section>

            <section aria-label="Clientes" className="flex flex-col gap-3">
              <h2 className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">
                {selectedOwner === "__all" ? "Clientes" : `Clientes de ${ownerGroups.get(selectedOwner)?.name ?? ""}`} ({list.length})
              </h2>

              <div
                aria-hidden
                className={`hidden gap-3 px-4 font-mono text-[10.5px] font-medium uppercase tracking-[0.12em] text-zinc-600 xl:grid ${finance ? GRID_FINANCE : GRID_TEAM}`}
              >
                <span>Nota</span>
                <span>Cliente</span>
                <span>Dono</span>
                <span>Meta</span>
                <span>Resultado 4 sem.</span>
                <span>Cliente</span>
                <span>8 semanas</span>
                {finance && <span className="text-right">Mensalidade</span>}
                <span />
              </div>

              {!data.clients.length ? (
                <Empty>Nenhum cliente no placar ainda. Use “Novo cliente” para cadastrar o primeiro.</Empty>
              ) : !list.length ? (
                <Empty>Nenhum cliente com esse dono.</Empty>
              ) : (
                <div className="flex flex-col gap-2">
                  {list.map((r) => (
                    <ClientRow
                      key={r.c.id}
                      row={r}
                      finance={finance}
                      onEntry={() => setEntryClient(r.c)}
                      onEdit={() => setClientDlg({ client: r.c })}
                    />
                  ))}
                </div>
              )}

              {inactiveCount > 0 && (
                <p className="text-[13px] text-zinc-500">
                  {inactiveCount} {inactiveCount === 1 ? "cliente inativo fora" : "clientes inativos fora"} da conta.{" "}
                  <button
                    type="button"
                    onClick={() => setShowInactive((v) => !v)}
                    className="font-semibold text-[#00e5ff] underline underline-offset-4"
                  >
                    {showInactive ? "Esconder" : "Mostrar"}
                  </button>
                </p>
              )}
            </section>
          </>
        )}

        <Rule />
      </div>

      {week && (
        <EntryDialog
          client={entryClient}
          week={week}
          entry={entryFor(entryClient)}
          apiBase={apiBase}
          onClose={() => setEntryClient(null)}
          onSaved={load}
        />
      )}
      <ClientDialog
        open={!!clientDlg}
        client={clientDlg?.client ?? null}
        audience={audience}
        owners={ownerNames}
        apiBase={apiBase}
        onClose={() => setClientDlg(null)}
        onSaved={load}
      />
    </div>
  );
}

// ---------- partes ----------

const GRID_TEAM =
  "xl:grid-cols-[60px_minmax(170px,1.6fr)_104px_minmax(120px,1fr)_minmax(130px,1.1fr)_56px_108px_150px]";
const GRID_FINANCE =
  "xl:grid-cols-[60px_minmax(170px,1.6fr)_96px_minmax(110px,1fr)_minmax(120px,1fr)_56px_108px_96px_150px]";

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-white/10 px-5 py-8 text-center text-[14px] text-zinc-500">
      {children}
    </div>
  );
}

function Notice({ tone, title, children }: { tone: "warn" | "bad"; title: string; children: React.ReactNode }) {
  const cls =
    tone === "bad"
      ? "border-red-500/25 bg-red-500/[0.06] text-red-400"
      : "border-amber-400/20 bg-amber-400/[0.05] text-amber-300";
  return (
    <div role="status" className={`rounded-xl border px-5 py-3.5 ${cls}`}>
      <p className="text-[13.5px] font-medium">{title}</p>
      <p className="mt-1 text-[12.5px] leading-relaxed opacity-80">{children}</p>
    </div>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: "bad" }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-xl border border-white/8 bg-white/[0.015] px-4 py-3.5">
      <span className="text-[12.5px] font-medium text-zinc-400">{label}</span>
      <span
        className={`font-mono text-[26px] font-semibold leading-tight tracking-[-0.02em] tabular-nums ${tone === "bad" ? "text-red-400" : "text-white"}`}
      >
        {value}
      </span>
      <span className="text-[12px] text-zinc-500">{sub}</span>
    </div>
  );
}

const feeOf = (r: Row) => (isNum(r.c.fee) ? r.c.fee : 0);
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function Summary({ rows, finance }: { rows: Row[]; finance: boolean }) {
  if (!rows.length) return null;
  const cnt: Record<Tone, number> = { good: 0, warn: 0, bad: 0, none: 0 };
  const fee: Record<Tone, number> = { good: 0, warn: 0, bad: 0, none: 0 };
  for (const r of rows) {
    cnt[r.s.tone]++;
    fee[r.s.tone] += feeOf(r);
  }
  const scored = rows.filter((r) => r.s.final !== null);
  const avg = scored.length ? mean(scored.map((r) => r.s.final as number)) : null;
  const totalFee = rows.reduce((s, r) => s + feeOf(r), 0);

  return (
    <section aria-label="Resumo da carteira" className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
      {finance ? (
        <>
          <Kpi label="Mensalidade em risco" value={fmtBRL(fee.bad)} sub={`${plural(cnt.bad, "cliente", "clientes")} no vermelho`} tone="bad" />
          <Kpi label="Sem leitura" value={fmtBRL(fee.none)} sub={`${plural(cnt.none, "cliente", "clientes")} sem meta ou sem número`} />
          <Kpi label="Nota média da carteira" value={avg === null ? "s/ nota" : fmtScore(avg)} sub={`${scored.length} de ${rows.length} com nota`} />
          <Kpi label="Mensalidade no placar" value={fmtBRL(totalFee)} sub={`${plural(rows.length, "cliente ativo", "clientes ativos")}`} />
        </>
      ) : (
        <>
          <Kpi label="No vermelho" value={String(cnt.bad)} sub={cnt.bad === 1 ? "cliente longe da meta" : "clientes longe da meta"} tone="bad" />
          <Kpi label="Sem leitura" value={String(cnt.none)} sub="sem meta ou sem número" />
          <Kpi label="Nota média da carteira" value={avg === null ? "s/ nota" : fmtScore(avg)} sub={`${scored.length} de ${rows.length} com nota`} />
          <Kpi label="Clientes no placar" value={String(rows.length)} sub="ativos nesta semana" />
        </>
      )}

      <div className="col-span-2 flex flex-col gap-2 lg:col-span-4">
        <div role="img" aria-label="Distribuição de cores" className="flex h-3 overflow-hidden rounded-full bg-white/[0.04]">
          {TONES.map((t) =>
            cnt[t] ? <span key={t} className={TONE_STYLE[t].solid} style={{ width: `${(cnt[t] / rows.length) * 100}%` }} /> : null,
          )}
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-[13px] text-zinc-400">
          {TONES.map((t) => (
            <span key={t} className="inline-flex items-center gap-1.5">
              <i aria-hidden className={`inline-block size-2.5 rounded-full ${TONE_STYLE[t].solid}`} />
              {TONE_STYLE[t].label} <b className="font-mono font-semibold text-white">{cnt[t]}</b>
              {finance && <span className="font-mono text-zinc-500">{fmtBRL(fee[t])}</span>}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function OwnerChip({
  name,
  rows,
  finance,
  pressed,
  onClick,
}: {
  name: string;
  rows: Row[];
  finance: boolean;
  pressed: boolean;
  onClick: () => void;
}) {
  const scored = rows.filter((r) => r.s.final !== null);
  const a = scored.length ? mean(scored.map((r) => r.s.final as number)) : null;
  const t = TONE_STYLE[toneOf(a)];
  const reds = rows.filter((r) => r.s.tone === "bad");
  const carry = rows.reduce((s, r) => s + feeOf(r), 0);
  const redFee = reds.reduce((s, r) => s + feeOf(r), 0);
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`flex items-center gap-2.5 rounded-xl border bg-white/[0.015] px-3 py-2 text-left transition hover:border-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00e5ff] ${
        pressed ? "border-[#00e5ff] shadow-[inset_0_0_0_1px_#00e5ff]" : "border-white/10"
      }`}
    >
      <span className={`min-w-[38px] rounded-md px-1.5 py-1 text-center font-mono text-[14px] font-semibold ${t.text} ${t.soft}`}>
        {a === null ? "s/n" : fmtScore(a)}
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-[14px] font-semibold text-white">{name}</span>
        <span className="text-[11.5px] text-zinc-500">
          {plural(rows.length, "cliente", "clientes")}
          {reds.length ? ` · ${reds.length} no vermelho` : ""}
        </span>
        {finance && (
          <span className="font-mono text-[11px] text-zinc-500">
            {fmtBRL(carry)} carrega{redFee ? <span className="text-red-400"> · {fmtBRL(redFee)} no vermelho</span> : null}
          </span>
        )}
      </span>
    </button>
  );
}

function Spark({ vals }: { vals: (number | null)[] }) {
  const w = 100;
  const h = 26;
  const step = w / (vals.length - 1);
  const y = (v: number) => h - 3 - (v / 10) * (h - 6);
  let d = "";
  let pen = false;
  vals.forEach((v, i) => {
    if (v === null) {
      pen = false;
      return;
    }
    d += `${pen ? "L" : "M"}${(i * step).toFixed(1)} ${y(v).toFixed(1)} `;
    pen = true;
  });
  const last = vals.map((v, i) => (v === null ? -1 : i)).filter((i) => i >= 0).pop();
  return (
    <svg width={w} height={h} viewBox={`-3 0 ${w + 6} ${h}`} aria-hidden className="block">
      <line x1={0} x2={w} y1={y(7)} y2={y(7)} stroke="rgba(255,255,255,0.12)" strokeDasharray="2 3" />
      <line x1={0} x2={w} y1={y(4)} y2={y(4)} stroke="rgba(255,255,255,0.12)" strokeDasharray="2 3" />
      {d && <path d={d} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />}
      {last !== undefined && <circle cx={(last * step).toFixed(1)} cy={y(vals[last] as number).toFixed(1)} r={2.6} fill="currentColor" />}
    </svg>
  );
}

function CellLabel({ children }: { children: React.ReactNode }) {
  return <span className="block font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-zinc-600 xl:hidden">{children}</span>;
}

function resultNode(c: BoardClient, s: Score) {
  const small = (t: string) => <span className="text-[12px] text-zinc-500">{t}</span>;
  if (c.kind === "projeto") return s.res === null ? small("sem marco lançado") : s.res === 10 ? "marco no prazo" : "marco atrasado";
  if (s.reason === "sem meta") return small("combinar a meta");
  if (!s.weeks) return small("nenhum número lançado");
  if (c.meta_mode === "taxa" || c.meta_mode === "custo")
    return (
      <>
        <span className="font-mono tabular-nums">{fmt2(s.avg ?? 0)}</span> {small("média")}
      </>
    );
  return (
    <>
      <span className="font-mono tabular-nums">{fmt2(s.sum)}</span> {small(`de ${fmt1((s.mw ?? 0) * s.weeks)} · ${s.weeks} sem.`)}
    </>
  );
}

function ClientRow({
  row: { c, s, spark },
  finance,
  onEntry,
  onEdit,
}: {
  row: Row;
  finance: boolean;
  onEntry: () => void;
  onEdit: () => void;
}) {
  const t = TONE_STYLE[s.tone];
  const owner = c.owner.trim();
  const mt = metaText(c);
  const chips: { text: string; warn?: boolean }[] = [];
  if (c.active === false) chips.push({ text: "inativo" });
  if (c.meta_review) chips.push({ text: "meta a revisar", warn: true });
  if (c.kind === "projeto") chips.push({ text: "projeto" });
  if (s.final !== null && !s.hasW) chips.push({ text: "falta lançar esta semana", warn: true });

  return (
    <article
      className={`relative grid grid-cols-[52px_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2.5 rounded-xl border border-white/8 bg-[#0f0f0f] px-4 py-3 xl:items-center xl:gap-y-0 ${finance ? GRID_FINANCE : GRID_TEAM}`}
    >
      <span aria-hidden className={`absolute -left-px bottom-2.5 top-2.5 w-[3px] rounded-r ${t.solid}`} />

      <div className="col-start-1 row-start-1 xl:col-auto xl:row-auto">
        {s.final === null ? (
          <span className={`grid h-11 w-[52px] place-items-center rounded-lg px-1 text-center text-[10.5px] leading-tight ${t.text} ${t.soft}`}>
            {s.reason || "sem nota"}
          </span>
        ) : (
          <span
            title={`Resultado ${s.res === null ? "s/n" : fmtScore(s.res)}${s.cs === null ? "" : ` · cliente ${fmtScore(s.cs)}`}`}
            className={`grid h-11 w-[52px] place-items-center rounded-lg font-mono text-[18px] font-semibold ${t.text} ${t.soft}`}
          >
            {fmtScore(s.final)}
          </span>
        )}
      </div>

      <div className={`row-start-1 flex min-w-0 flex-col gap-0.5 xl:col-auto xl:row-auto ${finance ? "col-start-2" : "col-span-2 col-start-2 xl:col-span-1"}`}>
        <strong className="text-[15px] font-semibold leading-snug text-white [overflow-wrap:anywhere]">{c.name}</strong>
        {c.delivers && <span className="text-[12.5px] text-zinc-500 [overflow-wrap:anywhere]">{c.delivers}</span>}
        {chips.length > 0 && (
          <span className="mt-1 flex flex-wrap gap-1">
            {chips.map((ch) => (
              <span
                key={ch.text}
                className={`whitespace-nowrap rounded-full border px-2 py-px text-[11px] ${ch.warn ? "border-amber-300/40 text-amber-300" : "border-white/10 text-zinc-400"}`}
              >
                {ch.text}
              </span>
            ))}
          </span>
        )}
      </div>

      {/* No celular e no tablet os três ficam numa faixa; no xl viram colunas da tabela. */}
      <div className="col-span-3 grid gap-2.5 sm:grid-cols-3 sm:gap-4 xl:contents">
        <div className="min-w-0 text-[13.5px] text-zinc-200">
          <CellLabel>Dono</CellLabel>
          {owner || <span className="text-[12px] text-zinc-500">sem dono</span>}
          {owner && !c.owner_ok && (
            <span className="ml-1.5 rounded-full border border-white/10 px-1.5 py-px text-[10.5px] text-zinc-500">palpite</span>
          )}
        </div>

        <div className="min-w-0 text-[13.5px] text-zinc-200 [overflow-wrap:anywhere]">
          <CellLabel>Meta</CellLabel>
          {c.kind === "projeto" ? (
            <span className="text-[12px] text-zinc-500">marco no prazo</span>
          ) : mt ? (
            mt
          ) : (
            <span className="text-[12px] text-zinc-500">sem meta</span>
          )}
          {c.meta_note && <span className="block text-[12px] leading-snug text-zinc-500">{c.meta_note}</span>}
        </div>

        <div className="min-w-0 text-[13.5px] text-zinc-200">
          <CellLabel>Resultado 4 sem.</CellLabel>
          {resultNode(c, s)}
        </div>
      </div>

      <div className="hidden font-mono text-[14px] tabular-nums text-zinc-200 xl:block">
        {s.cs === null ? <span className="text-[12px] text-zinc-500">s/n</span> : fmtScore(s.cs)}
      </div>

      <div className={`hidden xl:block ${t.text}`}>
        <Spark vals={spark} />
      </div>

      {finance && (
        <div className="col-start-3 row-start-1 text-right font-mono text-[13.5px] tabular-nums text-zinc-200 xl:col-auto xl:row-auto">
          {isNum(c.fee) ? fmtBRL(c.fee) : <span className="text-[12px] text-zinc-500">sem valor</span>}
        </div>
      )}

      <div className="col-span-3 flex gap-2 xl:col-span-1 xl:justify-end">
        <button type="button" onClick={onEntry} className={btnPrimary}>
          Lançar
        </button>
        <button type="button" onClick={onEdit} className={btnGhost}>
          Editar
        </button>
      </div>
    </article>
  );
}

function Rule() {
  return (
    <section aria-label="Como a nota sai" className="flex max-w-[760px] flex-col gap-2.5 rounded-xl border border-white/8 bg-white/[0.015] px-5 py-4">
      <h2 className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">Como a nota sai</h2>
      <p className="max-w-[68ch] text-[13.5px] leading-relaxed text-zinc-400">
        <b className="text-zinc-100">Resultado dividido pela meta, vezes 10, com teto 10.</b> Bater metade da meta dá 5. A
        conta olha as últimas 4 semanas, então cliente de meta mensal não pula de 0 para 10 de uma semana para outra.
        Quando a meta é de custo (CPA), a conta inverte.
      </p>
      <p className="max-w-[68ch] text-[13.5px] leading-relaxed text-zinc-400">
        <b className="text-zinc-100">Uma vez por mês o dono pergunta ao cliente uma nota de 0 a 10.</b> Vale a menor das
        duas, então número bom com cliente insatisfeito não fica verde.
      </p>
      <p className="max-w-[68ch] text-[13.5px] leading-relaxed text-zinc-400">
        <b className="text-zinc-100">Cliente de projeto</b> (site, loja, implantação) tira 10 com o marco entregue no prazo
        e 0 fora dele.
      </p>
      <p className="max-w-[68ch] text-[13.5px] leading-relaxed text-zinc-400">
        <b className="text-zinc-100">Verde</b> de 7 a 10, <b className="text-zinc-100">amarelo</b> de 4 a 6,9,{" "}
        <b className="text-zinc-100">vermelho</b> abaixo de 4, <b className="text-zinc-100">cinza</b> sem meta ou sem
        número. O número da semana entra até segunda, 10h. A decisão sobre cliente e liderança é no fim do trimestre.
      </p>
    </section>
  );
}
