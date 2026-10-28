"use client";

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
import { AnimatePresence, motion } from "motion/react";
import { Button, CONTAINER, Empty, Label, Metric, Modal, Notice, Pill, Score as Ring, SectionTitle, Skeleton, Surface, Trail, fmtScore as fmtRing, spring } from "@/components/ui";
import { PageHeader } from "./PageHeader";
import { roundOf, SEASON } from "@/lib/placar/rodada-rules";
import type { Audience, BoardClient, PlacarEntry, PlacarSnapshot } from "@/lib/placar/types";
import { ClientDialog, EntryDialog } from "./PlacarDialogs";

const OWNERS = ["Matheus", "Ramon", "Israel", "Sayuri"];
const REFRESH_MS = 30_000;
const TONES: Tone[] = ["good", "warn", "bad", "none"];

interface Row {
  c: BoardClient;
  s: Score;
  /** Últimas 8 semanas, a mais antiga primeiro. */
  trail: { final: number | null; tone: Tone }[];
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
  const [refreshing, setRefreshing] = useState(false);
  const [sheet, setSheet] = useState<Row | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [owner, setOwner] = useState("__all");
  const [showInactive, setShowInactive] = useState(false);
  const [entryClient, setEntryClient] = useState<BoardClient | null>(null);
  const [clientDlg, setClientDlg] = useState<{ client: BoardClient | null } | null>(null);
  const seq = useRef(0);

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
    const sparkWeeks = weeksBack(week, 8);
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
    <div className="min-h-screen bg-bg">
      <div className={`${CONTAINER} flex flex-col gap-7`}>

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
              <Button size="sm" onClick={() => setPickedWeek(null)}>
                Última semana fechada
              </Button>
              {!finance && (
                <Button size="sm" variant="soft" href="/placar/semana" icon={<Trophy aria-hidden strokeWidth={1.75} />}>
                  Rodada da semana
                  {currentMonday && roundOf(currentMonday) && (
                    <span className="type-caption tabular-nums text-dim">
                      {roundOf(currentMonday)}/{SEASON.rounds}
                    </span>
                  )}
                </Button>
              )}
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
          state === "loading" && <PlacarSkeleton />
        ) : (
          <>
            <Summary rows={active} finance={finance} />

            <section aria-label="Donos" className="flex flex-col gap-3">
              <Label as="p">Donos</Label>
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
              <SectionTitle
                title={selectedOwner === "__all" ? "Clientes" : `Clientes de ${ownerGroups.get(selectedOwner)?.name ?? ""}`}
                hint={`${list.length} ${list.length === 1 ? "cliente" : "clientes"}${inactiveCount > 0 ? ` · ${plural(inactiveCount, "inativo", "inativos")} fora da conta` : ""}`}
                right={
                  inactiveCount > 0 ? (
                    <Button variant="link" size="sm" onClick={() => setShowInactive((v) => !v)}>
                      {showInactive ? "Esconder inativos" : "Mostrar inativos"}
                    </Button>
                  ) : undefined
                }
              />

              <div aria-hidden className={`hidden gap-3 px-4 xl:grid ${finance ? GRID_FINANCE : GRID_TEAM}`}>
                <Label>Nota</Label>
                <Label>Cliente</Label>
                <Label>Dono</Label>
                <Label>Meta</Label>
                <Label>Resultado 4 sem.</Label>
                <Label>Cliente</Label>
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
                <Empty title="Nenhum cliente com esse dono" action={<Button onClick={() => setOwner("__all")}>Ver todos</Button>} />
              ) : (
                <ul className="flex flex-col gap-1.5">
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
  "xl:grid-cols-[44px_minmax(170px,1.6fr)_104px_minmax(120px,1fr)_minmax(130px,1.1fr)_48px_84px_150px]";
const GRID_FINANCE =
  "xl:grid-cols-[44px_minmax(170px,1.6fr)_96px_minmax(110px,1fr)_minmax(120px,1fr)_48px_84px_96px_150px]";

const feeOf = (r: Row) => (isNum(r.c.fee) ? r.c.fee : 0);
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function PlacarSkeleton() {
  return (
    <div className="flex flex-col gap-7" aria-busy aria-label="Carregando o placar">
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Surface key={i} className="flex flex-col gap-2 p-4">
            <Skeleton className="w-24" />
            <Skeleton shape="metric" />
            <Skeleton className="w-32" />
          </Surface>
        ))}
      </div>
      <Skeleton shape="text" lines={1} className="w-40" />
      <div className="flex flex-col gap-1.5">
        {Array.from({ length: 6 }, (_, i) => (
          <Surface key={i} className="flex items-center gap-3 px-4 py-3">
            <Skeleton shape="ring" />
            <Skeleton lines={2} className="w-48" />
          </Surface>
        ))}
      </div>
    </div>
  );
}

const SEG: Record<Tone, string> = { good: "bg-good", warn: "bg-warn", bad: "bg-bad", none: "bg-none" };
const TONE_LABEL: Record<Tone, string> = { good: "Verde", warn: "Amarelo", bad: "Vermelho", none: "Cinza" };

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
  const brl = (n: number) => fmtBRL(n);

  return (
    <section aria-label="Resumo da carteira" className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {finance ? (
          <>
            <Surface className="p-4"><Metric size="lg" value={fee.bad} format={brl} label="Mensalidade em risco" sub={`${plural(cnt.bad, "cliente", "clientes")} no vermelho`} tone={cnt.bad ? "bad" : undefined} /></Surface>
            <Surface className="p-4"><Metric size="lg" value={fee.none} format={brl} label="Sem leitura" sub={`${plural(cnt.none, "cliente", "clientes")} sem meta ou sem número`} /></Surface>
            <Surface className="p-4"><Metric size="lg" value={avg} format={fmtScore} label="Nota média da carteira" sub={`${scored.length} de ${rows.length} com nota`} tone={avg === null ? undefined : toneOf(avg)} /></Surface>
            <Surface className="p-4"><Metric size="lg" value={totalFee} format={brl} label="Mensalidade no placar" sub={plural(rows.length, "cliente ativo", "clientes ativos")} /></Surface>
          </>
        ) : (
          <>
            <Surface className="p-4"><Metric size="lg" value={cnt.bad} label="No vermelho" sub={cnt.bad === 1 ? "cliente longe da meta" : "clientes longe da meta"} tone={cnt.bad ? "bad" : undefined} /></Surface>
            <Surface className="p-4"><Metric size="lg" value={cnt.none} label="Sem leitura" sub="sem meta ou sem número" /></Surface>
            <Surface className="p-4"><Metric size="lg" value={avg} format={fmtScore} label="Nota média da carteira" sub={`${scored.length} de ${rows.length} com nota`} tone={avg === null ? undefined : toneOf(avg)} /></Surface>
            <Surface className="p-4"><Metric size="lg" value={cnt.good} unit={`${Math.round((cnt.good / rows.length) * 100)}%`} label="No verde" sub="meta do time 70%" tone={cnt.good ? "good" : undefined} /></Surface>
          </>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div role="img" aria-label="Distribuição de cores" className="flex h-2 gap-px overflow-hidden rounded-full bg-line">
          {TONES.map((t) =>
            cnt[t] ? (
              <motion.span
                key={t}
                className={`h-full ${SEG[t]}`}
                initial={false}
                animate={{ width: `${(cnt[t] / rows.length) * 100}%` }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              />
            ) : null,
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {TONES.map((t) => (
            <Pill key={t} tone={t}>
              {TONE_LABEL[t]} <span className="tabular-nums">{cnt[t]}</span>
              {finance && <span className="font-normal opacity-80">{fmtBRL(fee[t])}</span>}
            </Pill>
          ))}
        </div>
      </div>
    </section>
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
      className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-left ${pressed ? "border-line-strong" : ""}`}
    >
      <Ring value={a} tone={toneOf(a)} size={32} label={`${name}: ${a === null ? "sem nota" : `nota ${fmtRing(a)}`}`} />
      <span className="flex flex-col">
        <span className="type-body font-semibold text-fg">{name}</span>
        <span className="type-caption text-dim">
          {plural(rows.length, "cliente", "clientes")}
          {reds.length ? <span className="text-bad"> · {reds.length} no vermelho</span> : ""}
        </span>
        {finance && (
          <span className="type-caption tabular-nums text-dim">
            {fmtBRL(carry)}
            {redFee ? <span className="text-bad"> · {fmtBRL(redFee)} no vermelho</span> : null}
          </span>
        )}
      </span>
    </Surface>
  );
}

function CellLabel({ children }: { children: React.ReactNode }) {
  return <Label as="span" className="block xl:hidden">{children}</Label>;
}

const dim = (t: string) => <span className="type-caption text-dim">{t}</span>;

function resultNode(c: BoardClient, s: Score) {
  if (c.kind === "projeto") return s.res === null ? dim("sem marco lançado") : s.res === 10 ? "marco no prazo" : "marco atrasado";
  if (s.reason === "sem meta") return dim("combinar a meta");
  if (!s.weeks) return dim("nenhum número lançado");
  if (c.meta_mode === "taxa" || c.meta_mode === "custo")
    return (
      <>
        <span className="tabular-nums">{fmt2(s.avg ?? 0)}</span> {dim("média")}
      </>
    );
  return (
    <>
      <span className="tabular-nums">{fmt2(s.sum)}</span> {dim(`de ${fmt1((s.mw ?? 0) * s.weeks)} · ${s.weeks} sem.`)}
    </>
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
  const mt = metaText(c);
  const chips: { text: string; tone: "warn" | "neutral" }[] = [];
  if (c.active === false) chips.push({ text: "inativo", tone: "neutral" });
  if (c.meta_review) chips.push({ text: "meta a revisar", tone: "warn" });
  if (c.kind === "projeto") chips.push({ text: "projeto", tone: "neutral" });
  const needsEntry = c.kind === "projeto" ? s.res === null : !s.hasW;

  return (
    <Surface
      as="article"
      className={`relative grid grid-cols-[44px_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2.5 overflow-hidden px-4 py-2.5 xl:items-center xl:gap-y-0 ${s.tone === "bad" ? "before:absolute before:inset-y-3 before:left-0 before:w-0.5 before:rounded-r before:bg-bad before:content-['']" : ""} ${finance ? GRID_FINANCE : GRID_TEAM}`}
    >
      <button
        type="button"
        onClick={onScore}
        aria-label={`Como saiu a nota de ${c.name}`}
        className="col-start-1 row-start-1 rounded-full outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent xl:col-auto xl:row-auto"
      >
        <Ring value={s.final} tone={s.tone} size={40} />
      </button>

      <div className={`row-start-1 flex min-w-0 flex-col gap-0.5 xl:col-auto xl:row-auto ${finance ? "col-start-2" : "col-span-2 col-start-2 xl:col-span-1"}`}>
        <strong className="type-subtitle text-fg [overflow-wrap:anywhere]">{c.name}</strong>
        {c.delivers && <span className="type-caption text-dim [overflow-wrap:anywhere]">{c.delivers}</span>}
        {chips.length > 0 && (
          <span className="mt-1 flex flex-wrap gap-1">
            {chips.map((ch) => (
              <Pill key={ch.text} tone={ch.tone} className="h-5 px-2">
                {ch.text}
              </Pill>
            ))}
          </span>
        )}
      </div>

      {/* No celular e no tablet os três ficam numa faixa; no xl viram colunas da tabela. */}
      <div className="col-span-3 grid gap-2.5 sm:grid-cols-3 sm:gap-4 xl:contents">
        <div className="min-w-0 type-body text-fg">
          <CellLabel>Dono</CellLabel>
          {owner || dim("sem dono")}
          {owner && !c.owner_ok && <Pill className="ml-1.5 h-5 px-1.5 font-medium">palpite</Pill>}
        </div>

        <div className="min-w-0 type-body text-fg [overflow-wrap:anywhere]">
          <CellLabel>Meta</CellLabel>
          {c.kind === "projeto" ? dim("marco no prazo") : mt ? mt : dim("sem meta")}
          {c.meta_note && <span className="line-clamp-2 type-caption text-dim" title={c.meta_note}>{c.meta_note}</span>}
        </div>

        <div className="min-w-0 type-body text-fg">
          <CellLabel>Resultado 4 sem.</CellLabel>
          {resultNode(c, s)}
        </div>
      </div>

      <div className="hidden type-body tabular-nums text-fg xl:block">{s.cs === null ? dim("s/n") : fmtScore(s.cs)}</div>

      <div className="hidden xl:block">
        <Trail tones={trail.map((x) => x.tone)} scores={trail.map((x) => x.final)} label={`Últimas 8 semanas de ${c.name}`} />
      </div>

      {finance && (
        <div className="col-start-3 row-start-1 text-right type-body tabular-nums text-fg xl:col-auto xl:row-auto">
          {isNum(c.fee) ? fmtBRL(c.fee) : dim("sem valor")}
        </div>
      )}

      <div className="col-span-3 flex items-center gap-2 xl:col-span-1 xl:justify-end">
        {needsEntry ? (
          <Button size="sm" variant="primary" onClick={onEntry}>
            Lançar
          </Button>
        ) : (
          <>
            <Pill tone="good">Lançado</Pill>
            <Button size="sm" onClick={onEntry}>
              Editar número
            </Button>
          </>
        )}
        <Button size="sm" variant={needsEntry ? "ghost" : "link"} onClick={onEdit}>
          {needsEntry ? "Editar" : "Cliente"}
        </Button>
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
