"use client";

import { useState } from "react";
import { Button, Field, Notice, Surface } from "@/components/ui";
import { Logo } from "@/components/Logo";
import { send } from "./PlacarDialogs";

/**
 * A página do cliente (docs/placar-pedido-cliente.md): três perguntas, um minuto,
 * celular primeiro. Sem a meta da COB; só a referência neutra do último período.
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
  /** "Nas últimas 4 semanas foram 288 contatos." ou nulo sem leitura. */
  reference: string | null;
  /** Pedido já enviado neste mês, para o cliente ver o que mandou. */
  previous: { wanted: number; score: number; note: string } | null;
}) {
  const [wanted, setWanted] = useState(previous ? String(previous.wanted) : "");
  const [score, setScore] = useState(previous ? String(previous.score) : "");
  const [note, setNote] = useState(previous?.note ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
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
      <Surface light className="relative w-full max-w-[440px] p-6 sm:p-8">
        <Logo className="h-5" />
        <p className="type-caption mt-6 text-dim">{name}</p>

        {sent ? (
          <>
            <h1 className="type-title mt-1 text-fg">Recebido.</h1>
            <p className="type-body mt-2 text-mute">
              {owner ? `${owner} responde até o dia 1.` : "A COB responde até o dia 1."} Se mudar de ideia, abra este link de novo e mande outro número.
            </p>
          </>
        ) : (
          <>
            <h1 className="type-title mt-1 text-fg">O que você quer de resultado em {month}?</h1>
            <p className="type-body mt-2 text-mute">
              {reference ?? "Ainda não temos um período fechado de leitura para mostrar aqui."} Um minuto, três perguntas.
            </p>

            <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
              <Field
                id="wanted"
                label={`Que resultado você quer em ${month}? (${unit})`}
                type="text"
                inputMode="decimal"
                required
                value={wanted}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setWanted(e.target.value)}
                placeholder={`Número de ${unit}`}
              />
              <Field
                id="score"
                label="De 0 a 10, como foi o mês que passou com a COB?"
                type="number"
                inputMode="numeric"
                min={0}
                max={10}
                step={1}
                required
                value={score}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setScore(e.target.value)}
              />
              <Field
                id="note"
                as="textarea"
                label="O que muda no seu negócio no mês que vem?"
                hint="Promoção, estoque, férias, lançamento. Pode deixar em branco."
                maxLength={500}
                value={note}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNote(e.target.value)}
              />
              {error && <Notice tone="bad">{error}</Notice>}
              <Button type="submit" variant="primary" size="lg" pending={pending} className="w-full">
                Enviar
              </Button>
            </form>
          </>
        )}
      </Surface>
    </main>
  );
}
