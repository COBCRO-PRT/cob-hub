"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Menu } from "@base-ui/react/menu";
import { MoreHorizontal } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
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
import { cn } from "@/lib/utils";
import {
  Button,
  CONTAINER,
  Columns,
  Empty,
  KpiCard,
  Label,
  Modal,
  Notice,
  Pill,
  Score as Ring,
  SectionTitle,
  Skeleton,
  Surface,
  Trail,
  fmtScore as fmtRing,
  spring,
  type ColumnSeries,
} from "@/components/ui";
import { PageHeader } from "./PageHeader";
import type { Audience, BoardClient, PlacarEntry, PlacarSnapshot } from "@/lib/placar/types";
import { ClientDialog, EntryDialog } from "./PlacarDialogs";

const OWNERS = ["Matheus", "Ramon", "Israel", "Sayuri"];
const REFRESH_MS = 30_000;
const TONES: Tone[] = ["good", "warn", "bad", "none"];
const WEEKS = 8;

interface Row {
  c: BoardClient;
  s: Score;
  /** Últimas 8 semanas, a mais antiga primeiro. */
  trail: { final: number | null; tone: Tone }[];
}

/** Uma semana do histórico da carteira: contagem e mensalidade por tom, nota média. */
interface WeekStat {
  key: string;
  label: string;
  cnt: Record<Tone, number>;
  fee: Record<Tone, number>;
  avg: number | null;
  scored: number;
}

type LoadState = "loading" | "ok" | "error" | "auth";

// Liga só depois de montar no navegador: a semana sai do relógio local, e o
// servidor da Vercel está em UTC.
const subscribeNoop = () => () => {};
const useMounted = () => useSyncExternalStore(subscribeNoop, () => true, () => false);

const zeroByTone = (): Record<Tone, number> => ({ good: 0, warn: 0, bad: 0, none: 0 });

export function PlacarBoard({ audience, apiBase }: { audience: Audience; apiBase: string }) {
  const finance = audience === "finance";
  const mounted = useMounted();
  const reduce = useReducedMotion();
  const [pickedWeek, setPickedWeek] = useState<string | null>(null);
  const week = pickedWeek ?? (mounted ? lastClosedWeek() : null);

  const [data, setData] = useState<PlacarSnapshot | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [refreshing, setRefreshing] = useState(false);
  const [sheet, setSheet] = useState<Row | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [owner, setOwner] = useState("__all");
  const [toneFilter, setToneFilter] = useState<Tone | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [entryClient, setEntryClient] = useState<BoardClient | null>(null);
  const [clientDlg, setClientDlg] = useState<{ client: BoardClient | null } | null>(null);
  const seq = useRef(0);
  const listRef = useRef<HTMLElement>(null);

  const load = useCallback(async () => {
    if (!week) return;
    const mine = ++seq.current;
    setRefreshing(true);
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
    } finally {
      if (mine === seq.current) setRefreshing(false);
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
    const sparkWeeks = weeksBack(week, WEEKS);
    return data.clients.map((c) => {
      const list = by.get(c.id) ?? [];
      return {
        c,
        s: scoreFor(c, week, list),
        trail: sparkWeeks.map((w) => {
          const x = scoreFor(c, w, list);
          return { final: x.final, tone: x.tone };
        }),
      };
    });
  }, [data, week]);

  const active = useMemo(() => all.filter((r) => r.c.active !== false), [all]);
  const inactiveCount = all.length - active.length;

  /** Histórico da carteira por semana, lido do `trail` de cada cliente (a última é a semana em tela). */
  const stats: WeekStat[] = useMemo(() => {
    if (!week) return [];
    return weeksBack(week, WEEKS).map((w, i) => {
      const cnt = zeroByTone();
      const fee = zeroByTone();
      const finals: number[] = [];
      for (const r of active) {
        const t = r.trail[i];
        if (!t) continue;
        cnt[t.tone]++;
        fee[t.tone] += feeOf(r);
        if (t.final !== null) finals.push(t.final);
      }
      return { key: w, label: weekLabel(w).slice(0, 5), cnt, fee, avg: finals.length ? mean(finals) : null, scored: finals.length };
    });
  }, [active, week]);
  const now = stats[stats.length - 1];

  const reds = useMemo(
    () => active.filter((r) => r.s.tone === "bad").sort((a, b) => (a.s.final ?? 99) - (b.s.final ?? 99) || a.c.name.localeCompare(b.c.name, "pt-BR")),
    [active],
  );

  const noReadByOwner = useMemo(() => {
    const m = new Map<string, { name: string; n: number }>();
    for (const r of active) {
      if (r.s.tone !== "none") continue;
      const o = r.c.owner.trim();
      const key = o || "__none";
      const cur = m.get(key) ?? { name: o || "Sem dono", n: 0 };
      cur.n++;
      m.set(key, cur);
    }
    return [...m.entries()].sort((a, b) => b[1].n - a[1].n || a[1].name.localeCompare(b[1].name, "pt-BR"));
  }, [active]);

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
    if (toneFilter) rows = rows.filter((r) => r.s.tone === toneFilter);
    return [...rows].sort(
      (a, b) =>
        TONE_RANK[a.s.tone] - TONE_RANK[b.s.tone] ||
        (a.s.final ?? 99) - (b.s.final ?? 99) ||
        a.c.name.localeCompare(b.c.name, "pt-BR"),
    );
  }, [all, active, showInactive, selectedOwner, toneFilter]);

  const entryFor = (c: BoardClient | null) =>
    c && week && data ? data.entries.find((e) => e.id === `${c.id}_${week}`) : undefined;

  const go = (w: string) => setPickedWeek(w);

  const scrollToList = () => listRef.current?.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
  const seeTone = (t: Tone, ownerKey = "__all") => {
    setOwner(ownerKey);
    setToneFilter(t);
    scrollToList();
  };

  const listTitle =
    (toneFilter ? `Clientes ${TONE_LABEL_PLURAL[toneFilter]}` : "Clientes") +
    (selectedOwner === "__all" ? "" : ` de ${ownerGroups.get(selectedOwner)?.name ?? ""}`);

  return (
    <div className="min-h-screen bg-bg">
      <div className={`${CONTAINER} flex flex-col gap-6`}>

        <PageHeader
          eyebrow={`COB · gestão por resultado${finance ? " · visão do financeiro" : ""}`}
          title="Placar de Clientes"
          week={{
            ariaLabel: "Semana do placar",
            label: week ? weekLabel(week) : "…",
            hint: refreshing && data ? "atualizando…" : !week || !closed ? "semana lida" : week === closed ? "última semana fechada" : week > closed ? "semana em andamento" : "semana lida",
            onPrev: () => week && go(addWeeks(week, -1)),
            onNext: () => week && go(addWeeks(week, 1)),
            prevDisabled: !week,
            nextDisabled: !week || !currentMonday || week >= currentMonday,
          }}
          actions={
            <>
              <Button size="sm" onClick={() => setPickedWeek(null)} disabled={!pickedWeek || pickedWeek === closed}>
                Última semana fechada
              </Button>
              <Button size="sm" variant="primary" onClick={() => setClientDlg({ client: null })} disabled={state !== "ok"}>
                Novo cliente
              </Button>
            </>
          }
        />

        {data?.store === "file" && <Notice tone="info">Dados locais de desenvolvimento (arquivo no computador). Nada daqui chega ao time.</Notice>}

        {state === "auth" && (
          <Notice tone="warn" title="Sua sessão expirou" action={<Button size="sm" onClick={() => window.location.reload()}>Entrar de novo</Button>}>
            Recarregue a página para entrar de novo.
          </Notice>
        )}
        {state === "error" && (
          <Notice tone="bad" title={data ? "Não deu para atualizar o placar agora" : "Não deu para ler o placar"} action={<Button size="sm" variant="danger" onClick={load}>Tentar de novo</Button>}>
            {errorMsg} {data ? "Mostrando a última leitura." : ""}
          </Notice>
        )}

        {!data ? (
          state === "loading" && <PlacarSkeleton finance={finance} />
        ) : (
          <>
            {active.length > 0 && now && (
              <section aria-label="Resumo da carteira" className="grid grid-cols-12 gap-4">
                <Kpis stats={stats} now={now} total={active.length} />
                {finance && <FinanceKpis stats={stats} now={now} rows={active} />}

                <Surface light className="col-span-12 flex flex-col gap-4 p-4 sm:p-5 lg:col-span-8">
                  <SectionTitle title="Carteira por semana" hint="Clientes por cor nas últimas 8 semanas. Toque numa coluna para ler aquela semana." />
                  <div className="flex flex-wrap gap-1.5" aria-label={`Semana ${week ? weekLabel(week) : ""}`}>
                    {TONES.map((t) => (
                      <Pill key={t} tone={t}>
                        {TONE_LABEL[t]} <span className="tabular-nums">{now.cnt[t]}</span>
                        {finance && <span className="font-normal opacity-80">{fmtBRL(now.fee[t])}</span>}
                      </Pill>
                    ))}
                  </div>
                  <HeroChart
                    series={stats.map((s): ColumnSeries => ({ key: s.key, label: s.label, values: s.cnt }))}
                    highlight={week ?? undefined}
                    onPick={go}
                    label={`Carteira por semana: ${stats.map((s) => `${s.label}, ${s.cnt.good} no verde, ${s.cnt.warn} no amarelo, ${s.cnt.bad} no vermelho, ${s.cnt.none} sem leitura`).join("; ")}`}
                  />
                </Surface>

                <div className="col-span-12 flex flex-col gap-4 lg:col-span-4">
                  <Surface light className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="type-subtitle text-fg">No vermelho</h2>
                      <Pill tone={reds.length ? "bad" : "neutral"}>
                        <span className="tabular-nums">{reds.length}</span>
                      </Pill>
                    </div>
                    {reds.length ? (
                      <>
                        <ul className="flex flex-col gap-2.5">
                          {reds.slice(0, 4).map((r) => (
                            <li key={r.c.id} className="flex items-center gap-3">
                              <Ring value={r.s.final} tone={r.s.tone} size={32} />
                              <span className="flex min-w-0 flex-1 flex-col">
                                <span className="truncate type-body font-semibold text-fg">{r.c.name}</span>
                                <span className="truncate type-caption text-dim">{metaLine(r.c)}</span>
                              </span>
                            </li>
                          ))}
                        </ul>
                        <div className="mt-auto flex justify-end">
                          <Button size="sm" onClick={() => seeTone("bad")}>
                            {reds.length > 4 ? `Ver todos (${reds.length})` : "Ver todos"}
                          </Button>
                        </div>
                      </>
                    ) : (
                      <Empty title="Nenhum cliente no vermelho" className="flex-1 px-4 py-6" />
                    )}
                  </Surface>

                  <Surface light className="flex flex-col gap-3 p-4 sm:p-5">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="type-subtitle text-fg">Sem leitura</h2>
                      <Pill tone="neutral">
                        <span className="tabular-nums">{now.cnt.none}</span>
                      </Pill>
                    </div>
                    {noReadByOwner.length ? (
                      <ul className="flex flex-col gap-1">
                        {noReadByOwner.map(([key, o]) => (
                          <li key={key} className="flex h-9 items-center gap-3">
                            <span className="min-w-0 flex-1 truncate type-body text-fg">{o.name}</span>
                            <span className="type-metric-sm text-fg">{o.n}</span>
                            <Button size="sm" onClick={() => seeTone("none", key)} aria-label={`Ver os clientes sem leitura de ${o.name}`}>
                              Ver
                            </Button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="type-body text-mute">Todo cliente tem meta e número nesta semana.</p>
                    )}
                  </Surface>
                </div>
              </section>
            )}

            <section aria-label="Donos" className="flex flex-col gap-3">
              <Label as="p">Donos</Label>
              <div className="-mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
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

            <section ref={listRef} aria-label="Clientes" className="flex scroll-mt-6 flex-col gap-3">
              <SectionTitle
                title={listTitle}
                hint={`${list.length} ${list.length === 1 ? "cliente" : "clientes"}${inactiveCount > 0 ? ` · ${plural(inactiveCount, "inativo", "inativos")} fora da conta` : ""}`}
                right={
                  toneFilter || inactiveCount > 0 ? (
                    <>
                      {toneFilter && (
                        <Button size="sm" onClick={() => setToneFilter(null)}>
                          Limpar filtro
                        </Button>
                      )}
                      {inactiveCount > 0 && (
                        <Button size="sm" onClick={() => setShowInactive((v) => !v)}>
                          {showInactive ? "Esconder inativos" : "Mostrar inativos"}
                        </Button>
                      )}
                    </>
                  ) : undefined
                }
              />

              <div aria-hidden className={`hidden gap-3 px-4 xl:grid ${finance ? GRID_FINANCE : GRID_TEAM}`}>
                <Label>Nota</Label>
                <Label>Cliente</Label>
                <Label>Dono</Label>
                <Label>Meta</Label>
                <Label>Resultado 4 sem.</Label>
                <Label>8 semanas</Label>
                {finance && <Label className="text-right">Mensalidade</Label>}
                <span />
              </div>

              {!data.clients.length ? (
                <Empty
                  title="Nenhum cliente no placar ainda"
                  text="Cadastre o primeiro para começar a lançar números."
                  action={<Button variant="primary" onClick={() => setClientDlg({ client: null })}>Novo cliente</Button>}
                />
              ) : !list.length ? (
                toneFilter ? (
                  <Empty title={`Nenhum cliente ${TONE_LABEL_PLURAL[toneFilter]} aqui`} action={<Button onClick={() => setToneFilter(null)}>Limpar filtro</Button>} />
                ) : (
                  <Empty title="Nenhum cliente com esse dono" action={<Button onClick={() => setOwner("__all")}>Ver todos</Button>} />
                )
              ) : (
                <ul className="flex flex-col gap-1">
                  <AnimatePresence initial={false}>
                    {list.map((r) => (
                      <motion.li key={r.c.id} layout="position" transition={spring} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <ClientRow row={r} finance={finance} onEntry={() => setEntryClient(r.c)} onEdit={() => setClientDlg({ client: r.c })} onScore={() => setSheet(r)} />
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </section>
          </>
        )}

        <Rule />
      </div>

      <ScoreSheet row={sheet} onClose={() => setSheet(null)} />

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
  "xl:grid-cols-[80px_minmax(170px,1.5fr)_112px_minmax(130px,1fr)_minmax(150px,1fr)_84px_140px]";
const GRID_FINANCE =
  "xl:grid-cols-[80px_minmax(160px,1.5fr)_104px_minmax(120px,1fr)_minmax(140px,1fr)_84px_104px_140px]";

const feeOf = (r: Row) => (isNum(r.c.fee) ? r.c.fee : 0);
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const TONE_LABEL: Record<Tone, string> = { good: "Verde", warn: "Amarelo", bad: "Vermelho", none: "Cinza" };
const TONE_LABEL_PLURAL: Record<Tone, string> = { good: "no verde", warn: "no amarelo", bad: "no vermelho", none: "sem leitura" };

const metaLine = (c: BoardClient) => (c.kind === "projeto" ? "marco no prazo" : metaText(c) ?? "sem meta combinada");

function PlacarSkeleton({ finance }: { finance: boolean }) {
  return (
    <div className="flex flex-col gap-6" aria-busy aria-label="Carregando o placar">
      <div className="grid grid-cols-12 gap-4">
        {Array.from({ length: finance ? 8 : 4 }, (_, i) => (
          <Surface key={i} light className="col-span-6 flex flex-col gap-4 p-5 md:col-span-6 lg:col-span-3">
            <div className="flex flex-col gap-2">
              <Skeleton className="w-24" />
              <Skeleton shape="metric" />
              <Skeleton className="w-32" />
            </div>
            <div className="flex justify-end">
              <Skeleton shape="metric" className="h-7 w-12" />
            </div>
          </Surface>
        ))}
        <Surface light className="col-span-12 flex flex-col gap-4 p-5 lg:col-span-8">
          <Skeleton className="w-40" />
          <Skeleton shape="row" className="h-[248px]" />
        </Surface>
        <div className="col-span-12 flex flex-col gap-4 lg:col-span-4">
          <Surface light className="flex flex-1 flex-col gap-3 p-5">
            <Skeleton className="w-24" />
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton shape="ring" className="size-8" />
                <Skeleton lines={2} className="w-40" />
              </div>
            ))}
          </Surface>
          <Surface light className="flex flex-col gap-3 p-5">
            <Skeleton className="w-24" />
            <Skeleton lines={3} />
          </Surface>
        </div>
      </div>
      <Skeleton className="w-16" />
      <div className="flex gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} shape="row" className="h-12 w-36" />
        ))}
      </div>
      <div className="flex flex-col gap-1">
        {Array.from({ length: 8 }, (_, i) => (
          <Surface key={i} className="flex h-14 items-center gap-3 px-4">
            <Skeleton shape="ring" className="size-8" />
            <Skeleton lines={2} className="w-48" />
          </Surface>
        ))}
      </div>
    </div>
  );
}

const CHART_MIN = 220;

/**
 * O gráfico-herói preenche o card: no desktop a coluna da direita costuma ser mais alta,
 * então a caixa cresce com a linha da grade e o gráfico mede a altura dela (mínimo 220).
 */
function HeroChart({ series, highlight, onPick, label }: { series: ColumnSeries[]; highlight?: string; onPick: (k: string) => void; label: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(CHART_MIN);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setHeight(Math.max(CHART_MIN, Math.round(e.contentRect.height) - 28)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={box} className="relative flex-1" style={{ minHeight: CHART_MIN + 28 }}>
      <Columns series={series} highlight={highlight} height={height} onPick={onPick} label={label} className="absolute inset-0" />
    </div>
  );
}

/** Os 4 KPIs da carteira (D2.5), cada um com o spark das 8 semanas e a semana em tela acesa. */
function Kpis({ stats, now, total }: { stats: WeekStat[]; now: WeekStat; total: number }) {
  const last = stats.length - 1;
  const avgTone = now.avg === null ? "none" : toneOf(now.avg);
  const pct = total ? Math.round((now.cnt.good / total) * 100) : 0;
  const card = "col-span-6 md:col-span-6 lg:col-span-3";
  return (
    <>
      <KpiCard
        className={card}
        label="No verde"
        value={now.cnt.good}
        unit={`${pct}%`}
        sub={`${now.cnt.good} de ${total}, meta do time 70%`}
        tone={now.cnt.good ? "good" : undefined}
        spark={{ values: stats.map((s) => s.cnt.good), highlight: last, tone: "good", label: "Clientes no verde nas últimas 8 semanas" }}
      />
      <KpiCard
        className={card}
        label="No vermelho"
        value={now.cnt.bad}
        sub={now.cnt.bad === 1 ? "cliente longe da meta" : "clientes longe da meta"}
        tone={now.cnt.bad ? "bad" : undefined}
        spark={{ values: stats.map((s) => s.cnt.bad), highlight: last, tone: "bad", label: "Clientes no vermelho nas últimas 8 semanas" }}
      />
      <KpiCard
        className={card}
        label="Sem leitura"
        value={now.cnt.none}
        sub="sem meta ou sem número"
        spark={{ values: stats.map((s) => s.cnt.none), highlight: last, tone: "none", label: "Clientes sem leitura nas últimas 8 semanas" }}
      />
      <KpiCard
        className={card}
        label="Nota média da carteira"
        value={now.avg}
        format={fmtScore}
        sub={`${now.scored} de ${total} com nota`}
        tone={now.avg === null ? undefined : avgTone}
        spark={{ values: stats.map((s) => s.avg), highlight: last, tone: avgTone, label: "Nota média nas últimas 8 semanas" }}
      />
    </>
  );
}

/** Vista do financeiro: a mesma carteira em reais. Só chega aqui com `fee` no payload. */
function FinanceKpis({ stats, now, rows }: { stats: WeekStat[]; now: WeekStat; rows: Row[] }) {
  const last = stats.length - 1;
  const totalFee = rows.reduce((s, r) => s + feeOf(r), 0);
  const card = "col-span-6 md:col-span-6 lg:col-span-3";
  return (
    <>
      <KpiCard
        className={card}
        label="Mensalidade em risco"
        value={now.fee.bad}
        format={fmtBRL}
        sub={`${plural(now.cnt.bad, "cliente", "clientes")} no vermelho`}
        tone={now.cnt.bad ? "bad" : undefined}
        spark={{ values: stats.map((s) => s.fee.bad), highlight: last, tone: "bad", label: "Mensalidade no vermelho nas últimas 8 semanas" }}
      />
      <KpiCard
        className={card}
        label="Mensalidade sem leitura"
        value={now.fee.none}
        format={fmtBRL}
        sub={`${plural(now.cnt.none, "cliente", "clientes")} sem meta ou sem número`}
        spark={{ values: stats.map((s) => s.fee.none), highlight: last, tone: "none", label: "Mensalidade sem leitura nas últimas 8 semanas" }}
      />
      <KpiCard
        className={card}
        label="Mensalidade no verde"
        value={now.fee.good}
        format={fmtBRL}
        sub={`${plural(now.cnt.good, "cliente", "clientes")} na meta`}
        tone={now.cnt.good ? "good" : undefined}
        spark={{ values: stats.map((s) => s.fee.good), highlight: last, tone: "good", label: "Mensalidade no verde nas últimas 8 semanas" }}
      />
      <KpiCard
        className={card}
        label="Mensalidade no placar"
        value={totalFee}
        format={fmtBRL}
        sub={plural(rows.length, "cliente ativo", "clientes ativos")}
      />
    </>
  );
}

function OwnerChip({ name, rows, finance, pressed, onClick }: { name: string; rows: Row[]; finance: boolean; pressed: boolean; onClick: () => void }) {
  const scored = rows.filter((r) => r.s.final !== null);
  const a = scored.length ? mean(scored.map((r) => r.s.final as number)) : null;
  const reds = rows.filter((r) => r.s.tone === "bad");
  const carry = rows.reduce((s, r) => s + feeOf(r), 0);
  const redFee = reds.reduce((s, r) => s + feeOf(r), 0);
  return (
    <Surface
      as="button"
      interactive
      level={pressed ? 2 : 1}
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn("flex shrink-0 snap-start items-center gap-2.5 rounded-md px-3 py-2 text-left", pressed && "border-line-strong")}
    >
      <Ring value={a} tone={toneOf(a)} size={32} label={`${name}: ${a === null ? "sem nota" : `nota ${fmtRing(a)}`}`} />
      <span className="flex flex-col">
        <span className={cn("type-body font-semibold", pressed ? "text-fg" : "text-mute")}>{name}</span>
        <span className="type-caption whitespace-nowrap text-dim">
          {plural(rows.length, "cliente", "clientes")}
          {reds.length ? <span className="text-bad"> · {reds.length} no vermelho</span> : ""}
        </span>
        {finance && (
          <span className="type-caption whitespace-nowrap tabular-nums text-dim">
            {fmtBRL(carry)}
            {redFee ? <span className="text-bad"> · {fmtBRL(redFee)} no vermelho</span> : null}
          </span>
        )}
      </span>
    </Surface>
  );
}

const dim = (t: string) => <span className="type-caption text-dim">{t}</span>;
const num = (t: string) => <span className="type-metric-sm text-fg">{t}</span>;

/** Resultado das últimas 4 semanas: número em `metric-sm`, o resto apagado. */
function resultNode(c: BoardClient, s: Score) {
  if (c.kind === "projeto") return s.res === null ? dim("sem marco lançado") : s.res === 10 ? <>{num("No prazo")} {dim("marco")}</> : <>{num("Atrasado")} {dim("marco")}</>;
  if (s.reason === "sem meta") return dim("combinar a meta");
  if (!s.weeks) return dim("nenhum número lançado");
  if (c.meta_mode === "taxa" || c.meta_mode === "custo")
    return (
      <>
        {num(fmt2(s.avg ?? 0))} {dim(`média · ${s.weeks} sem.`)}
      </>
    );
  return (
    <>
      {num(fmt2(s.sum))} {dim(`de ${fmt1((s.mw ?? 0) * s.weeks)} de meta · ${s.weeks} sem.`)}
    </>
  );
}

const MORE_TRIGGER =
  "inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-line text-mute outline-none hover:border-line-strong hover:bg-surface-2 hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent data-popup-open:bg-surface-2 data-popup-open:text-fg max-sm:size-11 [&_svg]:size-4";
const MENU_ITEM =
  "flex h-9 cursor-default items-center rounded-md px-2.5 type-body text-fg outline-none select-none data-highlighted:bg-surface-2";

/** Menu "mais" da linha: as ações que não cabem em 56px. */
function RowMenu({ name, hasEntry, onEntry, onEdit }: { name: string; hasEntry: boolean; onEntry: () => void; onEdit: () => void }) {
  return (
    <Menu.Root>
      <Menu.Trigger className={MORE_TRIGGER} aria-label={`Mais ações para ${name}`}>
        <MoreHorizontal aria-hidden strokeWidth={1.75} />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="end" sideOffset={6} className="z-50">
          <Menu.Popup className="min-w-[180px] rounded-panel border border-line bg-surface-1 p-1.5 shadow-float outline-none">
            <Menu.Item className={MENU_ITEM} onClick={onEntry}>
              {hasEntry ? "Editar número" : "Lançar número"}
            </Menu.Item>
            <Menu.Item className={MENU_ITEM} onClick={onEdit}>
              Editar cliente
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

function ClientRow({
  row: { c, s, trail },
  finance,
  onEntry,
  onEdit,
  onScore,
}: {
  row: Row;
  finance: boolean;
  onEntry: () => void;
  onEdit: () => void;
  onScore: () => void;
}) {
  const owner = c.owner.trim();
  const mt = c.kind === "projeto" ? "marco no prazo" : metaText(c);
  const metaTitle = [mt ?? "sem meta", c.meta_note].filter(Boolean).join(". ");
  const chips: { text: string; tone: "warn" | "neutral" }[] = [];
  if (c.active === false) chips.push({ text: "inativo", tone: "neutral" });
  if (c.meta_review) chips.push({ text: "meta a revisar", tone: "warn" });
  if (c.kind === "projeto") chips.push({ text: "projeto", tone: "neutral" });
  const needsEntry = c.kind === "projeto" ? s.res === null : !s.hasW;
  const subline = [c.delivers, owner || "sem dono", finance ? (isNum(c.fee) ? fmtBRL(c.fee) : "sem valor") : ""].filter(Boolean).join(" · ");

  return (
    <Surface
      as="article"
      className={cn(
        "relative grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 overflow-hidden px-4 py-3 xl:h-14 xl:gap-y-0 xl:py-0",
        finance ? GRID_FINANCE : GRID_TEAM,
        s.tone === "bad" && "before:absolute before:inset-y-4 before:left-0 before:w-0.5 before:rounded-r before:bg-bad before:content-['']",
      )}
    >
      <button
        type="button"
        onClick={onScore}
        aria-label={`Como saiu a nota de ${c.name}`}
        className="col-start-1 row-start-1 flex items-center gap-2 rounded-full outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent xl:col-auto xl:row-auto"
      >
        <Ring value={s.final} tone={s.tone} size={32} bare />
        <span className={cn("type-metric-sm", s.final === null ? "text-dim" : "text-fg")}>{s.final === null ? "s/n" : fmtScore(s.final)}</span>
      </button>

      <div className="col-start-2 row-start-1 flex min-w-0 flex-col xl:col-auto xl:row-auto">
        <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 xl:flex-nowrap">
          <strong className="max-w-full truncate type-subtitle text-fg">{c.name}</strong>
          {chips.map((ch) => (
            <Pill key={ch.text} tone={ch.tone} className="h-5 shrink-0 px-1.5">
              {ch.text}
            </Pill>
          ))}
        </span>
        {c.delivers && <span className="hidden truncate type-caption text-dim xl:block">{c.delivers}</span>}
        <span className="truncate type-caption text-dim xl:hidden">{subline}</span>
      </div>

      <div className="hidden min-w-0 items-center gap-1.5 type-body text-fg xl:flex">
        <span className="truncate">{owner || dim("sem dono")}</span>
        {owner && !c.owner_ok && <Pill className="h-5 shrink-0 px-1.5 font-medium">palpite</Pill>}
      </div>

      <div className="col-span-2 col-start-1 row-start-2 flex min-w-0 flex-col xl:col-span-1 xl:col-auto xl:row-auto" title={metaTitle}>
        <span className="truncate type-body text-fg">{mt ?? dim("sem meta")}</span>
        <span className="truncate xl:hidden">{resultNode(c, s)}</span>
      </div>

      <div className="hidden min-w-0 truncate xl:block">{resultNode(c, s)}</div>

      <div className="col-start-3 row-start-1 hidden sm:block xl:col-auto xl:row-auto">
        <Trail tones={trail.map((x) => x.tone)} scores={trail.map((x) => x.final)} label={`Últimas 8 semanas de ${c.name}`} />
      </div>

      {finance && (
        <div className="hidden text-right type-body tabular-nums text-fg xl:block">
          {isNum(c.fee) ? fmtBRL(c.fee) : dim("sem valor")}
        </div>
      )}

      <div className="col-start-3 row-start-2 flex items-center justify-end gap-1.5 xl:col-auto xl:row-auto">
        {needsEntry ? (
          <Button size="sm" variant="soft" onClick={onEntry}>
            Lançar
          </Button>
        ) : (
          <Pill tone="good">Lançado</Pill>
        )}
        <RowMenu name={c.name} hasEntry={!needsEntry} onEntry={onEntry} onEdit={onEdit} />
      </div>
    </Surface>
  );
}

/** Folha com a conta da nota: no toque substitui a dica de hover. */
function ScoreSheet({ row, onClose }: { row: Row | null; onClose: () => void }) {
  const s = row?.s;
  return (
    <Modal open={row !== null} onClose={onClose} size="sm" title={row ? `Como saiu a nota de ${row.c.name}` : "Nota"}>
      {row && s && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <Ring value={s.final} tone={s.tone} size={56} />
            <div className="flex flex-col gap-0.5">
              <span className="type-subtitle text-fg">{s.final === null ? (s.reason || "sem nota") : `Nota ${fmtScore(s.final)}`}</span>
              <span className="type-caption text-dim">{TONE_LABEL[s.tone]} · vale a menor entre resultado e nota do cliente</span>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-0.5"><dt className="type-label text-dim">Resultado contra a meta</dt><dd className="type-subtitle tabular-nums text-fg">{s.res === null ? "s/n" : fmtScore(s.res)}</dd></div>
            <div className="flex flex-col gap-0.5"><dt className="type-label text-dim">Nota do cliente</dt><dd className="type-subtitle tabular-nums text-fg">{s.cs === null ? "s/n" : fmtScore(s.cs)}</dd></div>
            <div className="col-span-2 flex flex-col gap-0.5"><dt className="type-label text-dim">Últimas 4 semanas</dt><dd className="type-body text-fg">{resultNode(row.c, s)}</dd></div>
          </dl>
          <Trail tones={row.trail.map((x) => x.tone)} scores={row.trail.map((x) => x.final)} size="md" />
        </div>
      )}
    </Modal>
  );
}

const P = ({ children }: { children: React.ReactNode }) => <p className="max-w-[68ch] type-body text-mute">{children}</p>;
const B = ({ children }: { children: React.ReactNode }) => <b className="font-semibold text-fg">{children}</b>;

function Rule() {
  return (
    <section aria-label="Como a nota sai" className="flex max-w-[760px] flex-col gap-3">
      <SectionTitle title="Como a nota sai" />
      <P>
        <B>Resultado dividido pela meta, vezes 10, com teto 10.</B> Bater metade da meta dá 5. A conta olha as últimas 4 semanas, então
        cliente de meta mensal não pula de 0 para 10 de uma semana para outra. Quando a meta é de custo (CPA), a conta inverte.
      </P>
      <P>
        <B>Uma vez por mês o dono pergunta ao cliente uma nota de 0 a 10.</B> Vale a menor das duas, então número bom com cliente
        insatisfeito não fica verde.
      </P>
      <P>
        <B>Cliente de projeto</B> (site, loja, implantação) tira 10 com o marco entregue no prazo e 0 fora dele.
      </P>
      <P>
        <B>Verde</B> de 7 a 10, <B>amarelo</B> de 4 a 6,9, <B>vermelho</B> abaixo de 4, <B>cinza</B> sem meta ou sem número. O número da
        semana entra até segunda, 10h. A decisão sobre cliente e liderança é no fim do trimestre.
      </P>
    </section>
  );
}
