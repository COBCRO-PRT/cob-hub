"use client";

import { useState } from "react";
import { Button, Notice, Pill, Surface } from "@/components/ui";
import { CONTROL } from "@/components/ui/field";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";
import { send } from "./PlacarDialogs";

const nf = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const SCORES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/** "R$ em vendas" vira prefixo "R$" e sufixo "em vendas"; "contatos" vira só sufixo. */
function splitUnit(unit: string): { prefix: string | null; suffix: string } {
  return unit.startsWith("R$ ") ? { prefix: "R$", suffix: unit.slice(3) } : { prefix: null, suffix: unit };
}

/**
 * A página do cliente (docs/placar-pedido-cliente.md): três perguntas numeradas, um minuto,
 * celular primeiro. Sem a meta da COB; só a referência neutra do último período.
 * Uma ideia visual: as três perguntas. O acento fica no botão de mandar.
 */
export function PedidoForm({
  client,
  code,
  name,
  owner,
  month,
  unit,
  reference,
  previous,
}: {
  client: string;
  code: string;
  name: string;
  owner: string;
  /** "dezembro de 2026". */
  month: string;
  unit: string;
  /** Resultado das últimas semanas fechadas, na unidade da ficha. Nulo sem leitura. */
  reference: { value: number; weeks: number } | null;
  /** Pedido já enviado neste mês, para o cliente ver o que mandou. */
  previous: { wanted: number; score: number; note: string } | null;
}) {
  const [wanted, setWanted] = useState(previous ? String(previous.wanted) : "");
  const [score, setScore] = useState<number | null>(previous?.score ?? null);
  const [note, setNote] = useState(previous?.note ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const monthName = month.split(" de ")[0];
  const { prefix, suffix } = splitUnit(unit);
  const who = owner || "A Colombo Media";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (score === null) {
      setError("Escolha uma nota de 0 a 10 para o mês que passou.");
      return;
    }
    setPending(true);
    setError(null);
    const err = await send("/api/placar/pedido", "PUT", { client, code, wanted_value: wanted, score, note });
    setPending(false);
    if (err) setError(err);
    else setSent(true);
  }

  return (
    <main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-bg px-4 py-8 sm:px-6">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-glow-accent opacity-60" />
      <Surface light className="relative w-full max-w-[460px] p-6 sm:p-8">
        <div className="flex items-center justify-between gap-3">
          <Logo className="h-5" />
          <Pill tone="neutral">{month}</Pill>
        </div>

        {sent ? (
          <div className="mt-8">
            <p className="type-caption text-mute">{name}</p>
            <h1 className="type-display mt-2 text-fg">Recebido.</h1>
            <p className="type-body mt-3 text-mute">
              {who} responde até o dia 1. Se mudar de ideia, abra este link de novo e mande outro número.
            </p>
          </div>
        ) : (
          <>
            <p className="type-caption mt-8 text-mute">{name}</p>
            <h1 className="type-display mt-2 text-balance text-fg">O que você quer de resultado em {monthName}?</h1>

            <div className="mt-5 flex items-baseline justify-between gap-3 rounded-sm border border-line bg-surface-2 px-4 py-3">
              <span className="type-caption text-mute">{reference ? `Últimas ${reference.weeks} semanas` : "Leitura"}</span>
              {reference ? (
                <span className="type-metric-sm text-fg">
                  {prefix ? `${prefix} ` : ""}
                  {nf.format(reference.value)} <span className="type-caption font-medium text-mute">{suffix}</span>
                </span>
              ) : (
                <span className="type-caption text-mute">ainda sem período fechado</span>
              )}
            </div>

            <form onSubmit={submit} className="mt-8 flex flex-col gap-8">
              <Question n={1} id="wanted" text={`Que resultado você quer em ${monthName}?`}>
                <div className="relative">
                  {prefix && <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center type-subtitle text-mute">{prefix}</span>}
                  <input
                    id="wanted"
                    type="text"
                    inputMode="decimal"
                    required
                    value={wanted}
                    onChange={(e) => setWanted(e.target.value)}
                    placeholder="0"
                    className={cn(CONTROL, "py-3 type-subtitle sm:text-base", prefix ? "pl-11" : "", "pr-28")}
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center type-caption text-mute">{suffix}</span>
                </div>
              </Question>

              <Question n={2} id="score-0" text="De 0 a 10, como foi o mês que passou com a Colombo Media?">
                <div role="radiogroup" aria-label="Nota de 0 a 10" className="grid grid-cols-6 gap-1.5 sm:grid-cols-11 sm:gap-1">
                  {SCORES.map((n) => {
                    const on = score === n;
                    return (
                      <button
                        key={n}
                        id={`score-${n}`}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => setScore(n)}
                        className={cn(
                          "h-11 rounded-sm border type-caption tabular-nums outline-none motion-safe:transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                          on ? "border-accent bg-accent-soft font-semibold text-accent-text" : "border-line bg-surface-2 text-fg hover:border-line-strong",
                        )}
                      >
                        {n}
                      </button>
                    );
                  })}
                </div>
                <div className="flex justify-between type-caption text-dim">
                  <span>ruim</span>
                  <span>ótimo</span>
                </div>
              </Question>

              <Question n={3} id="note" text="O que muda no seu negócio no mês que vem?" hint="Promoção, estoque, férias, lançamento. Pode deixar em branco.">
                <textarea
                  id="note"
                  rows={3}
                  maxLength={500}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className={cn(CONTROL, "min-h-20 resize-y")}
                />
              </Question>

              {error && <Notice tone="bad">{error}</Notice>}

              <div className="flex flex-col gap-3">
                <Button type="submit" variant="primary" size="lg" pending={pending} className="w-full">
                  Mandar para a Colombo Media
                </Button>
                <p className="text-center type-caption text-dim">Leva um minuto. {who} responde até o dia 1.</p>
              </div>
            </form>
          </>
        )}
      </Surface>
    </main>
  );
}

/** Uma pergunta numerada: índice apagado, pergunta em frase, o controle embaixo. */
function Question({ n, id, text, hint, children }: { n: number; id: string; text: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <label htmlFor={id} className="flex items-start gap-3">
        <span className="type-caption shrink-0 pt-0.5 tabular-nums text-dim">{n}</span>
        <span className="type-subtitle text-fg">{text}</span>
      </label>
      <div className="flex flex-col gap-2 sm:pl-6">
        {children}
        {hint && <p className="type-caption text-dim">{hint}</p>}
      </div>
    </div>
  );
}
