"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight, CircleCheck, Flame } from "lucide-react";
import { Bar, Button, Empty, Label, Modal, Pill, Score as Ring, SectionTitle, Surface, Trail, spring } from "@/components/ui";
import { STREAK } from "@/lib/placar/rodada-rules";
import type { LaunchLine, Mission } from "@/lib/placar/jogo";
import type { RodadaClient, RodadaTaskInfo } from "@/lib/placar/rodada";
import type { RodadaTone } from "@/lib/placar/types";
import { TONE_RANK, addWeeks, fmtScore, weekLabel } from "@/lib/placar/score";
import { cn } from "@/lib/utils";
import { EXTERNAL_LINK, KIND, TONE_LABEL, closesAt, countdown, plural, useNow } from "./comum";

export const SEM_DONO = "sem-dono";

/** Quem aparece: "todos", um dono ou quem está sem dono. */
export const matches = (picked: string, owner: string) =>
  picked === "todos" || (picked === SEM_DONO ? !owner : owner === picked);

/** Chips de pessoa com a linguagem de "selecionado" da D2.2: `surface-2` + `fg`, sem ciano. */
export function PersonFilter({ owners, picked, onPick }: { owners: string[]; picked: string; onPick: (o: string) => void }) {
  const opts = [
    { id: "todos", label: "Todos" },
    ...owners.map((o) => ({ id: o, label: o })),
    { id: SEM_DONO, label: "Sem dono" },
  ];
  return (
    <div role="group" aria-label="Ver por pessoa" className="flex flex-wrap gap-2">
      {opts.map((o) => {
        const on = picked === o.id;
        return (
          <Surface
            as="button"
            interactive
            level={on ? 2 : 1}
            key={o.id}
            type="button"
            aria-pressed={on}
            onClick={() => onPick(o.id)}
            className={cn("inline-flex h-8 items-center rounded-full px-3.5 type-caption font-semibold max-sm:h-11 max-sm:px-4", on ? "border-line-strong text-fg" : "text-mute")}
          >
            {o.label}
          </Surface>
        );
      })}
    </div>
  );
}

const FIRST = 6;
/** Abaixo de 4 a nota é vermelha; a barra da virada mede o caminho até essa marca. */
const RED_LIMIT = 4;

/**
 * Missões da semana (D2.5): prazo e lançados por pessoa no título, o filtro de pessoa logo abaixo
 * e a grade de 2 colunas com a missão de virada em destaque. 6 visíveis, "Ver todas" abre o resto.
 */
export function Missions({
  missions,
  launch,
  week,
  picked,
  filter,
  className,
}: {
  missions: Mission[];
  launch: LaunchLine[];
  week: string;
  picked: string;
  /** Os chips de pessoa, que filtram esta seção e as vizinhas. */
  filter?: React.ReactNode;
  className?: string;
}) {
  const now = useNow();
  const [all, setAll] = useState(false);
  const list = missions.filter((m) => matches(picked, m.owner));
  const open = list.filter((m) => !m.done);
  const prize = open.reduce((n, m) => n + m.points, 0);
  const shown = all ? list : list.slice(0, FIRST);
  const bars = launch.filter((l) => matches(picked, l.owner) && picked !== SEM_DONO);
  const deadline = now ? `fecha em ${countdown(closesAt(week) - now)}, segunda às 10h` : `${weekLabel(week)}, fecha segunda às 10h`;

  return (
    <section id="missoes" aria-label="Missões da semana" className={cn("flex scroll-mt-20 flex-col gap-4", className)}>
      <SectionTitle title="Missões da semana" hint={`${deadline} · ${plural(open.length, "aberta", "abertas")}, +${prize} pts em jogo`} />

      {/* Lançados por pessoa e o filtro ficam em linhas que quebram: no celular o slot do título não cabe. */}
      {bars.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5" aria-label="Números da semana lançados">
          <Label className="mr-1">Lançados</Label>
          {bars.map((l) => (
            <Pill key={l.owner} tone={l.done === l.total ? "good" : "neutral"} aria-label={`${l.owner}: ${l.done} de ${l.total} lançados`}>
              {l.owner}{" "}
              <span className="tabular-nums">
                {l.done}/{l.total}
              </span>
            </Pill>
          ))}
        </div>
      )}

      {filter}

      {list.length ? (
        <>
          <ul className="grid gap-3 sm:grid-cols-2">
            <AnimatePresence initial={false}>
              {shown.map((m) => (
                <MissionCard key={`${m.client}_${m.kind}`} m={m} />
              ))}
            </AnimatePresence>
          </ul>
          {list.length > FIRST && (
            <Button size="sm" onClick={() => setAll(!all)} className="self-center">
              {all ? "Mostrar menos" : `Ver todas as ${list.length} missões`}
            </Button>
          )}
        </>
      ) : (
        <Empty
          title="Nenhuma missão para esta pessoa nesta semana"
          text="Troque a pessoa acima ou lance números no placar."
          action={
            <Button size="sm" variant="soft" href="/placar">
              Lançar no placar
            </Button>
          }
        />
      )}
    </section>
  );
}

/** Cartão de missão em `Surface light`. A de virada (+5) ocupa as duas colunas, com o anel maior e a barra do que falta. */
export function MissionCard({ m }: { m: Mission }) {
  const k = KIND[m.kind];
  const Icon = k.icon;
  const big = m.kind === "virada";
  return (
    <motion.li
      layout="position"
      transition={spring}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={cn("min-w-0", big && "sm:col-span-2")}
    >
      <Surface light className="flex h-full flex-col gap-3 p-4">
        <span className="flex items-center justify-between gap-2">
          {m.done ? (
            <Pill tone="good" icon={<CircleCheck aria-hidden strokeWidth={1.75} />}>
              cumprida
            </Pill>
          ) : (
            <Pill tone={k.tone} icon={<Icon aria-hidden strokeWidth={1.75} />}>
              {k.label}
            </Pill>
          )}
          <span className={cn("type-metric-sm", m.done ? "text-dim" : "text-fg")}>+{m.points}</span>
        </span>
        <span className="flex items-center gap-3">
          {/* Anel de 32 sem número (D2.4): a nota de "10,0" não cabe nele; o tom já conta a história. */}
          <Ring value={m.score} tone={m.tone} size={big ? 40 : 32} bare={!big} />
          <span className="flex min-w-0 flex-col">
            <span className="truncate type-subtitle text-fg">{m.name}</span>
            <span className="type-caption text-dim">{m.owner || "sem dono"}</span>
          </span>
        </span>
        <span className={cn("type-body", m.blocked ? "text-warn" : m.done ? "text-mute" : "text-fg")}>{m.todo}</span>
        {big && !m.done && (
          <Bar value={m.score ?? 0} max={RED_LIMIT} tone="bad" size="sm" label={`nota ${m.score === null ? "sem nota" : fmtScore(m.score)} de ${RED_LIMIT} para sair do vermelho`} />
        )}
      </Surface>
    </motion.li>
  );
}

const TONES: RodadaTone[] = ["bad", "none", "warn", "good"];

/** Mapa da carteira (D2.5): um tile com a contagem por tom no topo e um anel de 32 por cliente, sem número (lista densa, D2.4). Clicar abre a ficha. */
export function ClientMap({
  rows,
  picked,
  missions,
  tasks,
  className,
}: {
  rows: RodadaClient[];
  picked: string;
  missions: Mission[];
  tasks: RodadaTaskInfo[];
  className?: string;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const list = useMemo(
    () =>
      rows
        .filter((r) => matches(picked, r.owner))
        .sort((a, b) => TONE_RANK[a.tone] - TONE_RANK[b.tone] || a.name.localeCompare(b.name, "pt-BR")),
    [rows, picked],
  );
  const count = (t: RodadaTone) => list.filter((r) => r.tone === t).length;
  const sel = rows.find((r) => r.client === open) ?? null;

  return (
    <section id="mapa" aria-label="Mapa da carteira" className={cn("scroll-mt-20", className)}>
      <Surface className="flex h-full flex-col gap-4 p-5">
        <SectionTitle title="Mapa da carteira" hint="Toque num cliente para abrir a ficha." />
        <div className="flex flex-wrap gap-1.5" aria-label="Clientes por faixa">
          {TONES.map((t) => (
            <Pill key={t} tone={t}>
              {TONE_LABEL[t]} <span className="tabular-nums">{count(t)}</span>
            </Pill>
          ))}
        </div>
        {list.length ? (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(88px,1fr))] gap-2">
            <AnimatePresence initial={false}>
              {list.map((r) => (
                <motion.li key={r.client} layout="position" transition={spring} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="min-w-0">
                  <button
                    type="button"
                    onClick={() => setOpen(r.client)}
                    className="flex min-h-11 w-full flex-col items-center gap-1.5 rounded-md px-1 py-2 text-center outline-none motion-safe:transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    <Ring value={r.score} tone={r.tone} size={32} bare label={`${r.name}: ${r.score === null ? "sem nota" : `nota ${fmtScore(r.score)}`}, ${TONE_LABEL[r.tone].toLowerCase()}`} />
                    <span className="line-clamp-2 w-full type-caption text-fg [overflow-wrap:anywhere]">{r.name}</span>
                    {r.greenStreak >= 2 && (
                      <span className="inline-flex items-center gap-0.5 type-caption tabular-nums text-good">
                        <Flame aria-hidden className="size-3" strokeWidth={1.75} />
                        {r.greenStreak} no verde
                      </span>
                    )}
                    {r.redStreak >= 2 && <span className="type-caption tabular-nums text-bad">{r.redStreak}× vermelho</span>}
                  </button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        ) : (
          <Empty title="Nenhum cliente para esta pessoa nesta rodada" text="Troque a pessoa no filtro das missões." />
        )}
      </Surface>
      <ClientSheet
        row={sel}
        mission={sel ? (missions.find((m) => m.client === sel.client) ?? null) : null}
        task={sel ? ([...tasks].reverse().find((t) => t.client === sel.client && !t.closed) ?? null) : null}
        onClose={() => setOpen(null)}
      />
    </section>
  );
}

/** Ficha do cliente na folha (`Modal sm`): nota, pontos, sequência, últimas rodadas, missão e tarefa. */
export function ClientSheet({
  row,
  mission,
  task,
  onClose,
}: {
  row: RodadaClient | null;
  mission: Mission | null;
  task: RodadaTaskInfo | null;
  onClose: () => void;
}) {
  const weeks = row ? row.trail.map((_, i) => weekLabel(addWeeks(row.week, i - row.trail.length + 1))) : [];
  return (
    <Modal
      open={row !== null}
      onClose={onClose}
      size="sm"
      title={row?.name ?? "Cliente"}
      description={row ? `${row.owner || "sem dono"}${row.meta ? ` · meta ${row.meta}` : " · sem meta"}` : undefined}
      footer={
        <>
          <Button size="sm" variant="soft" href="/placar">
            Lançar no placar
          </Button>
          {task && (
            <Button size="sm" href={task.url} {...EXTERNAL_LINK} iconEnd={<ArrowUpRight aria-hidden strokeWidth={1.75} />}>
              Tarefa no ClickUp
            </Button>
          )}
        </>
      }
    >
      {row && (
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-4">
            <Ring value={row.score} tone={row.tone} size={56} />
            <dl className="grid flex-1 grid-cols-2 gap-3">
              <div className="flex flex-col gap-0.5">
                <dt className="type-label text-dim">Pontos</dt>
                <dd className="type-metric-sm text-fg">+{row.points}</dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="type-label text-dim">{row.tone === "bad" ? "No vermelho" : "No verde"}</dt>
                <dd className={cn("type-metric-sm", row.tone === "bad" ? "text-bad" : "text-good")}>{row.tone === "bad" ? `${row.redStreak}×` : `${row.greenStreak}×`}</dd>
              </div>
            </dl>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Últimas {row.trail.length} rodadas</Label>
            <Trail tones={row.trail} size="md" label={`Últimas ${row.trail.length} rodadas: ${row.trail.map((t, i) => `${weeks[i]} ${TONE_LABEL[t].toLowerCase()}`).join(", ")}`} />
            {row.greenStreak > 0 && row.greenStreak < STREAK && (
              <span className="type-caption text-mute">Faltam {STREAK - row.greenStreak} rodadas no verde para o selo de indicação.</span>
            )}
            {row.badges.length > 0 && (
              <span className="type-caption text-good">
                Nesta rodada: {row.badges.map((b) => (b === "virada" ? "virada" : "selo de sequência")).join(" e ")}
              </span>
            )}
          </div>

          {mission && (
            <div className="flex flex-col gap-1.5">
              <span className="flex flex-wrap items-center gap-2">
                <Label>Missão desta semana</Label>
                {mission.done ? <Pill tone="good">cumprida</Pill> : <Pill tone={KIND[mission.kind].tone}>{KIND[mission.kind].label}</Pill>}
                <span className="type-caption tabular-nums text-dim">+{mission.points}</span>
              </span>
              <span className={cn("type-body", mission.blocked ? "text-warn" : "text-fg")}>{mission.todo}</span>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
