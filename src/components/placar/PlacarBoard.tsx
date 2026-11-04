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
  buildLadder,
  fmtRead,
  KIND_LABEL,
  nextText,
  PLATFORM_LABEL,
  platformCurve,
  platformFor,
  SECTOR_LABEL,
  TIER_LABEL,
  type ClientLadder,
  type Curve,
  type Platform,
  type PlatformRead,
} from "@/lib/placar/degrau";
import { byClient } from "@/lib/placar/jogo";
import {
  Button,
  CONTAINER,
  Columns,
  Empty,
  KpiCard,
  Label,
  Ladder,
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
  type LadderMark,
  type PillTone,
} from "@/components/ui";
import { PageHeader } from "./PageHeader";
import type { Audience, BoardClient, PlacarSnapshot, Tier } from "@/lib/placar/types";
import { ClientDialog, EntryDialog } from "./PlacarDialogs";

const OWNERS = ["Matheus", "Ramon", "Israel", "Sayuri"];
const REFRESH_MS = 30_000;
const TONES: Tone[] = ["good", "warn", "bad", "none"];
const WEEKS = 8;

/** Leitura de uma plataforma na ficha: custo do cliente e a mediana da COB nela. */
interface PlatformLine {
  platform: Platform;
  read: PlatformRead;
  curve: Curve | null;
}

interface Row {
  c: BoardClient;
  s: Score;
  /** Últimas 8 semanas, a mais antiga primeiro. */
  trail: { final: number | null; tone: Tone }[];
  /** Degrau no mercado (docs/placar-benchmark.md). Nulo para quem não é cliente de mídia. */
  ladder: ClientLadder | null;
  plat: PlatformLine[];
}

/** Uma semana do histórico da carteira: contagem e mensalidade por tom, nota média. */
interface WeekStat {
  key: string;
  label: string;
  cnt: Record<Tone, number>;
  fee: Record<Tone, number>;
  avg: number | null;
  scored: number;
  /** Clientes em Prata ou Ouro e quantos têm leitura de degrau. */
  up: number;
  laddered: number;
  feeUp: number;
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
  const [sector, setSector] = useState("__all");
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
      setData({ clients: body.clients, entries: body.entries, benchmarks: body.benchmarks ?? [], store: body.store });
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

  /** Escada de cada semana do histórico (a última é a semana em tela). */
  const ladders = useMemo(() => {
    if (!data || !week) return new Map<string, Map<string, ClientLadder>>();
    const by = byClient(data.entries);
    return new Map(weeksBack(week, WEEKS).map((w) => [w, buildLadder(data.clients, by, data.benchmarks, w)]));
  }, [data, week]);

  const all: Row[] = useMemo(() => {
    if (!data || !week) return [];
    const by = byClient(data.entries);
    const sparkWeeks = weeksBack(week, WEEKS);
    const now = ladders.get(week);
    const curves = new Map<string, Curve | null>();
    const curveOf = (c: BoardClient, p: Platform) => {
      const k = `${c.result_kind}_${p}`;
      if (!curves.has(k)) curves.set(k, platformCurve(c, data.clients, by, p, week));
      return curves.get(k) ?? null;
    };
    return data.clients.map((c) => {
      const list = by.get(c.id) ?? [];
      const ladder = now?.get(c.id) ?? null;
      const plat: PlatformLine[] = [];
      if (ladder) {
        for (const p of ["meta", "google"] as Platform[]) {
          const read = platformFor(c, week, list, p);
          if (read) plat.push({ platform: p, read, curve: curveOf(c, p) });
        }
      }
      return {
        c,
        s: scoreFor(c, week, list),
        trail: sparkWeeks.map((w) => {
          const x = scoreFor(c, w, list);
          return { final: x.final, tone: x.tone };
        }),
        ladder,
        plat,
      };
    });
  }, [data, week, ladders]);

  const active = useMemo(() => all.filter((r) => r.c.active !== false), [all]);
  const inactiveCount = all.length - active.length;

  /** Histórico da carteira por semana, lido do `trail` de cada cliente (a última é a semana em tela). */
  const stats: WeekStat[] = useMemo(() => {
    if (!week) return [];
    return weeksBack(week, WEEKS).map((w, i) => {
      const cnt = zeroByTone();
      const fee = zeroByTone();
      const finals: number[] = [];
      const lad = ladders.get(w);
      let up = 0;
      let laddered = 0;
      let feeUp = 0;
      for (const r of active) {
        const t = r.trail[i];
        if (!t) continue;
        cnt[t.tone]++;
        fee[t.tone] += feeOf(r);
        if (t.final !== null) finals.push(t.final);
        const tier = lad?.get(r.c.id)?.tier;
        if (tier) laddered++;
        if (tier === "prata" || tier === "ouro") {
          up++;
          feeUp += feeOf(r);
        }
      }
      return { key: w, label: weekLabel(w).slice(0, 5), cnt, fee, avg: finals.length ? mean(finals) : null, scored: finals.length, up, laddered, feeUp };
    });
  }, [active, week, ladders]);
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

  /** Setores com cliente ativo, na ordem do catálogo; "Sem setor" por último. */
  const sectorGroups = useMemo(() => {
    const groups = new Map<string, { name: string; rows: Row[] }>();
    for (const key of Object.keys(SECTOR_LABEL)) {
      const rs = active.filter((r) => r.c.sector === key);
      if (rs.length) groups.set(key, { name: SECTOR_LABEL[key], rows: rs });
    }
    const none = active.filter((r) => !r.c.sector || !(r.c.sector in SECTOR_LABEL));
    if (none.length) groups.set("__none", { name: "Sem setor", rows: none });
    return groups;
  }, [active]);
  const selectedSector = sectorGroups.has(sector) ? sector : "__all";

  const list = useMemo(() => {
    let rows = showInactive ? all : active;
    if (selectedOwner === "__none") rows = rows.filter((r) => !r.c.owner.trim());
    else if (selectedOwner !== "__all") rows = rows.filter((r) => r.c.owner.trim() === selectedOwner);
    if (selectedSector === "__none") rows = rows.filter((r) => !r.c.sector || !(r.c.sector in SECTOR_LABEL));
    else if (selectedSector !== "__all") rows = rows.filter((r) => r.c.sector === selectedSector);
    if (toneFilter) rows = rows.filter((r) => r.s.tone === toneFilter);
    return [...rows].sort(
      (a, b) =>
        TONE_RANK[a.s.tone] - TONE_RANK[b.s.tone] ||
        (a.s.final ?? 99) - (b.s.final ?? 99) ||
        a.c.name.localeCompare(b.c.name, "pt-BR"),
    );
  }, [all, active, showInactive, selectedOwner, selectedSector, toneFilter]);

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
    (selectedOwner === "__all" ? "" : ` de ${ownerGroups.get(selectedOwner)?.name ?? ""}`) +
    (selectedSector === "__all" ? "" : ` · ${sectorGroups.get(selectedSector)?.name ?? ""}`);

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
                <div className="col-span-12 grid grid-cols-2 gap-4 lg:grid-cols-5">
                  <Kpis stats={stats} now={now} total={active.length} />
                </div>
                {finance && (
                  <div className="col-span-12 grid grid-cols-2 gap-4 lg:grid-cols-5">
                    <FinanceKpis stats={stats} now={now} rows={active} />
                  </div>
                )}

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

            {sectorGroups.size > 0 && (
              <section aria-label="Setores" className="flex flex-col gap-3">
                <Label as="p">Setores</Label>
                <div className="-mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
                  <SectorChip name="Todos" rows={active} pressed={selectedSector === "__all"} onClick={() => setSector("__all")} />
                  {[...sectorGroups.entries()].map(([key, g]) => (
                    <SectorChip key={key} name={g.name} rows={g.rows} pressed={selectedSector === key} onClick={() => setSector(selectedSector === key ? "__all" : key)} />
                  ))}
                </div>
              </section>
            )}

            <section ref={listRef} aria-label="Clientes" className="flex scroll-mt-6 flex-col gap-3">
              <SectionTitle
                title={listTitle}
                hint={`${list.length} ${list.length === 1 ? "cliente" : "clientes"}${inactiveCount > 0 ? ` · ${plural(inactiveCount, "inativo", "inativos")} fora da conta` : ""}`}
                right={
                  toneFilter || selectedSector !== "__all" || inactiveCount > 0 ? (
                    <>
                      {(toneFilter || selectedSector !== "__all") && (
                        <Button size="sm" onClick={() => { setToneFilter(null); setSector("__all"); }}>
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
                <Label>Degrau</Label>
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
                  <Empty title={selectedSector === "__all" ? "Nenhum cliente com esse dono" : "Nenhum cliente nesse setor"} action={<Button onClick={() => { setOwner("__all"); setSector("__all"); }}>Ver todos</Button>} />
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
  "xl:grid-cols-[80px_minmax(160px,1.5fr)_104px_minmax(120px,1fr)_minmax(140px,1fr)_minmax(124px,1fr)_84px_140px]";
const GRID_FINANCE =
  "xl:grid-cols-[80px_minmax(150px,1.5fr)_96px_minmax(110px,1fr)_minmax(130px,1fr)_minmax(116px,1fr)_84px_96px_130px]";

const feeOf = (r: Row) => (isNum(r.c.fee) ? r.c.fee : 0);
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const TONE_LABEL: Record<Tone, string> = { good: "Verde", warn: "Amarelo", bad: "Vermelho", none: "Cinza" };
const TONE_LABEL_PLURAL: Record<Tone, string> = { good: "no verde", warn: "no amarelo", bad: "no vermelho", none: "sem leitura" };

const metaLine = (c: BoardClient) => (c.kind === "projeto" ? "marco no prazo" : metaText(c) ?? "sem meta combinada");

function PlacarSkeleton({ finance }: { finance: boolean }) {
  return (
    <div className="flex flex-col gap-6" aria-busy aria-label="Carregando o placar">
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 grid grid-cols-2 gap-4 lg:grid-cols-5">
          {Array.from({ length: finance ? 10 : 5 }, (_, i) => (
            <Surface key={i} light className="flex flex-col gap-4 p-5">
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
        </div>
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

/** Os 5 KPIs da carteira (D2.5), cada um com o spark das 8 semanas e a semana em tela acesa. */
function Kpis({ stats, now, total }: { stats: WeekStat[]; now: WeekStat; total: number }) {
  const last = stats.length - 1;
  const avgTone = now.avg === null ? "none" : toneOf(now.avg);
  const pct = total ? Math.round((now.cnt.good / total) * 100) : 0;
  const upPct = now.laddered ? Math.round((now.up / now.laddered) * 100) : 0;
  return (
    <>
      <KpiCard
        label="No verde"
        value={now.cnt.good}
        unit={`${pct}%`}
        sub={`${now.cnt.good} de ${total}, meta do time 70%`}
        tone={now.cnt.good ? "good" : undefined}
        spark={{ values: stats.map((s) => s.cnt.good), highlight: last, tone: "good", label: "Clientes no verde nas últimas 8 semanas" }}
      />
      <KpiCard
        label="No vermelho"
        value={now.cnt.bad}
        sub={now.cnt.bad === 1 ? "cliente longe da meta" : "clientes longe da meta"}
        tone={now.cnt.bad ? "bad" : undefined}
        spark={{ values: stats.map((s) => s.cnt.bad), highlight: last, tone: "bad", label: "Clientes no vermelho nas últimas 8 semanas" }}
      />
      <KpiCard
        label="Sem leitura"
        value={now.cnt.none}
        sub="sem meta ou sem número"
        spark={{ values: stats.map((s) => s.cnt.none), highlight: last, tone: "none", label: "Clientes sem leitura nas últimas 8 semanas" }}
      />
      <KpiCard
        label="Nota média da carteira"
        value={now.avg}
        format={fmtScore}
        sub={`${now.scored} de ${total} com nota`}
        tone={now.avg === null ? undefined : avgTone}
        spark={{ values: stats.map((s) => s.avg), highlight: last, tone: avgTone, label: "Nota média nas últimas 8 semanas" }}
      />
      <KpiCard
        className="col-span-2 lg:col-span-1"
        label="Em Prata ou Ouro"
        value={now.up}
        unit={now.laddered ? `${upPct}%` : undefined}
        sub={now.laddered ? `${now.up} de ${now.laddered} com leitura de degrau` : "ninguém com leitura de degrau"}
        spark={{ values: stats.map((s) => s.up), highlight: last, tone: "gold", label: "Clientes em Prata ou Ouro nas últimas 8 semanas" }}
      />
    </>
  );
}

/** Vista do financeiro: a mesma carteira em reais. Só chega aqui com `fee` no payload. */
function FinanceKpis({ stats, now, rows }: { stats: WeekStat[]; now: WeekStat; rows: Row[] }) {
  const last = stats.length - 1;
  const totalFee = rows.reduce((s, r) => s + feeOf(r), 0);
  return (
    <>
      <KpiCard
        label="Mensalidade em risco"
        value={now.fee.bad}
        format={fmtBRL}
        sub={`${plural(now.cnt.bad, "cliente", "clientes")} no vermelho`}
        tone={now.cnt.bad ? "bad" : undefined}
        spark={{ values: stats.map((s) => s.fee.bad), highlight: last, tone: "bad", label: "Mensalidade no vermelho nas últimas 8 semanas" }}
      />
      <KpiCard
        label="Mensalidade sem leitura"
        value={now.fee.none}
        format={fmtBRL}
        sub={`${plural(now.cnt.none, "cliente", "clientes")} sem meta ou sem número`}
        spark={{ values: stats.map((s) => s.fee.none), highlight: last, tone: "none", label: "Mensalidade sem leitura nas últimas 8 semanas" }}
      />
      <KpiCard
        label="Mensalidade no verde"
        value={now.fee.good}
        format={fmtBRL}
        sub={`${plural(now.cnt.good, "cliente", "clientes")} na meta`}
        tone={now.cnt.good ? "good" : undefined}
        spark={{ values: stats.map((s) => s.fee.good), highlight: last, tone: "good", label: "Mensalidade no verde nas últimas 8 semanas" }}
      />
      <KpiCard
        label="Mensalidade no placar"
        value={totalFee}
        format={fmtBRL}
        sub={plural(rows.length, "cliente ativo", "clientes ativos")}
      />
      <KpiCard
        className="col-span-2 lg:col-span-1"
        label="Mensalidade em Prata ou Ouro"
        value={now.feeUp}
        format={fmtBRL}
        sub={`${plural(now.up, "cliente", "clientes")} no degrau ou acima`}
        spark={{ values: stats.map((s) => s.feeUp), highlight: last, tone: "gold", label: "Mensalidade em Prata ou Ouro nas últimas 8 semanas" }}
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

/** Filtro por setor: o mesmo gesto do dono, sem o anel (o setor não tem nota própria). */
function SectorChip({ name, rows, pressed, onClick }: { name: string; rows: Row[]; pressed: boolean; onClick: () => void }) {
  const up = rows.filter((r) => r.ladder?.tier === "prata" || r.ladder?.tier === "ouro").length;
  return (
    <Surface
      as="button"
      interactive
      level={pressed ? 2 : 1}
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn("flex shrink-0 snap-start flex-col rounded-md px-3 py-1.5 text-left", pressed && "border-line-strong")}
    >
      <span className={cn("type-body font-semibold", pressed ? "text-fg" : "text-mute")}>{name}</span>
      <span className="type-caption whitespace-nowrap text-dim">
        {plural(rows.length, "cliente", "clientes")}
        {up ? <span className="text-fg"> · {up} em Prata ou Ouro</span> : ""}
      </span>
    </Surface>
  );
}

/** Mesma paleta do chip da rodada (semana/tier-chip.tsx): o vermelho fica só para a nota. */
const TIER_TONE: Record<Tier, PillTone> = { ouro: "gold", prata: "strong", bronze: "neutral", abaixo: "warn", "": "none" };

function TierChip({ tier, className }: { tier: Tier; className?: string }) {
  return (
    <Pill tone={TIER_TONE[tier]} className={cn("h-5 shrink-0 px-1.5", tier === "" && "font-medium text-dim", className)}>
      {TIER_LABEL[tier]}
    </Pill>
  );
}

/** "R$ 18,40 por conversa" ou "2,4x de retorno"; sem gasto lido, diz isso. */
function readText(l: ClientLadder): string {
  if (!l.read) return "sem gasto lido";
  if (l.read.value === null) return "gasto sem resultado";
  return l.read.metric === "custo" ? `${fmtRead("custo", l.read.value)} por ${KIND_LABEL[l.read.kind]}` : `${fmtRead("roas", l.read.value)} de retorno`;
}

/** Chip do degrau e a leitura de custo, na lista e na ficha. */
function TierCell({ c, ladder, className }: { c: BoardClient; ladder: ClientLadder | null; className?: string }) {
  if (!ladder) {
    return <span className={cn("flex items-center", className)}>{c.kind === "projeto" ? null : dim("sem grupo")}</span>;
  }
  return (
    <span className={cn("flex min-w-0 flex-col gap-0.5", className)} title={nextText(ladder) ?? undefined}>
      <span className="flex items-center gap-1.5">
        <TierChip tier={ladder.tier} />
        {ladder.tier && ladder.cobScope === "geral" && <Pill className="h-5 shrink-0 px-1.5 font-medium">COB geral</Pill>}
      </span>
      <span className="truncate type-caption text-dim">{readText(ladder)}</span>
    </span>
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
  row: { c, s, trail, ladder },
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
  if (c.meta_auto) chips.push({ text: "meta automática", tone: "neutral" });
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
        {ladder && (
          <span className="mt-1 flex items-center gap-1.5 xl:hidden">
            <TierChip tier={ladder.tier} />
            <span className="truncate type-caption text-dim">{readText(ladder)}</span>
          </span>
        )}
      </div>

      <div className="hidden min-w-0 truncate xl:block">{resultNode(c, s)}</div>

      <TierCell c={c} ladder={ladder} className="hidden xl:flex" />

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
          {row.ladder && <LadderSheet c={row.c} l={row.ladder} plat={row.plat} />}
        </div>
      )}
    </Modal>
  );
}

const fmtDate = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
};

/** Marcos da régua: a curva do mercado (p25, p50, p75) e o Bronze da COB; sem mercado, a curva da COB. */
function marksOf(l: ClientLadder): LadderMark[] {
  const metric = l.read?.metric ?? (l.market?.metric ?? "custo");
  const f = (v: number) => fmtRead(metric, v);
  const out: LadderMark[] = [];
  const bronze = l.steps.find((st) => st.tier === "bronze");
  if (l.market) {
    const m = l.market;
    if (isNum(m.p25)) out.push({ at: m.p25, label: metric === "custo" ? "Ouro p25" : "p25", text: f(m.p25) });
    if (isNum(m.p50)) out.push({ at: m.p50, label: "Prata p50", text: f(m.p50) });
    if (isNum(m.p75)) out.push({ at: m.p75, label: metric === "custo" ? "p75" : "Ouro p75", text: f(m.p75) });
    if (bronze) out.push({ at: bronze.limit, label: l.cob ? "Bronze COB" : "Bronze", text: f(bronze.limit) });
  } else if (l.cob) {
    for (const st of l.steps) out.push({ at: st.limit, label: `${TIER_LABEL[st.tier]} COB`, text: f(st.limit) });
    const top = metric === "custo" ? l.cob.p75 : l.cob.p25;
    if (isNum(top)) out.push({ at: top, label: metric === "custo" ? "p75 COB" : "p25 COB", text: f(top) });
  }
  return out;
}

/** A régua do mercado na ficha do cliente (docs/placar-benchmark.md, "Na tela"). */
function LadderSheet({ c, l, plat }: { c: BoardClient; l: ClientLadder; plat: PlatformLine[] }) {
  const metric = l.read?.metric ?? l.market?.metric ?? "custo";
  const marks = marksOf(l);
  const group = `${SECTOR_LABEL[c.sector] ?? c.sector} · ${KIND_LABEL[c.result_kind] || "sem tipo"}`;
  const next = nextText(l);
  return (
    <section aria-label="Degrau no mercado" className="flex flex-col gap-3 border-t border-line pt-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <Label as="p">Degrau no mercado</Label>
          <span className="type-caption text-dim">{group}</span>
        </div>
        <span className="flex items-center gap-1.5">
          {l.cobScope === "geral" && <Pill className="h-5 px-1.5 font-medium">COB geral</Pill>}
          <TierChip tier={l.tier} />
        </span>
      </div>
      {marks.length ? (
        <Ladder
          value={l.read?.value ?? null}
          valueText={l.read ? fmtRead(metric, l.read.value) : undefined}
          steps={l.steps}
          marks={marks}
          better={metric === "custo" ? "low" : "high"}
          label={`Régua do mercado: ${marks.map((m) => `${m.label} ${m.text}`).join(", ")}; ${c.name} em ${l.read ? fmtRead(metric, l.read.value) : "sem leitura"}`}
        />
      ) : (
        <p className="type-body text-mute">Sem curva para este grupo ainda. O degrau fica a medir até existir leitura de mercado ou de 3 clientes da COB.</p>
      )}
      <p className="type-body text-fg">
        {next
          ? next.charAt(0).toUpperCase() + next.slice(1)
          : l.tier === "ouro"
            ? "No topo da escada; a cobrança passa a ser em volume."
            : l.tier && !l.market
              ? "Ouro fica a medir até existir curva de mercado para o grupo."
              : `${readText(l).charAt(0).toUpperCase()}${readText(l).slice(1)}.`}
      </p>
      {plat.length > 0 && (
        <dl className="flex flex-col gap-1.5">
          {plat.map((p) => (
            <div key={p.platform} className="flex items-baseline justify-between gap-3">
              <dt className="type-body text-mute">{PLATFORM_LABEL[p.platform]}</dt>
              <dd className="flex items-baseline gap-2 text-right">
                <span className="type-body font-semibold tabular-nums text-fg">
                  {p.read.value === null ? "gasto sem resultado" : metric === "custo" ? `${fmtRead("custo", p.read.value)} por ${KIND_LABEL[c.result_kind]}` : `${fmtRead("roas", p.read.value)} de retorno`}
                </span>
                {p.curve && isNum(p.curve.p50) && <span className="type-caption tabular-nums text-dim">COB p50 {fmtRead(metric, p.curve.p50)}</span>}
              </dd>
            </div>
          ))}
        </dl>
      )}
      <p className="type-caption text-dim">
        {l.market
          ? `Mercado: ${l.market.source}${l.market.captured_at ? `, lido em ${fmtDate(l.market.captured_at)}` : ""}.`
          : "Sem coorte de mercado para este grupo; a régua é a carteira COB."}
        {plat.some((p) => p.platform === "google") ? " O Google não tem coorte de mercado; a referência dele é só a COB." : ""}
      </p>
    </section>
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
