"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button, Field, Label, Notice } from "@/components/ui";
import { fmtRead, type ClientLadder } from "@/lib/placar/degrau";
import { metaText } from "@/lib/placar/score";
import { monthLabel, nextMonth } from "@/lib/placar/pedido-shared";
import type { BoardClient, PlacarPedido } from "@/lib/placar/types";
import { send } from "./PlacarDialogs";

const nf = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
/** Mesmo teto de metas.ts: a meta sobe no máximo 50% sobre o que o cliente faz hoje com a verba. */
const CAP = 1.5;

/** O custo (ou retorno) que a régua mira para este cliente: o próximo degrau, ou o Ouro para quem já está lá. */
function targetOf(l: ClientLadder): number | null {
  return l.next?.limit ?? l.steps[0]?.limit ?? null;
}

/**
 * Bloco "Pedido do cliente" na ficha (docs/placar-pedido-cliente.md). O pedido nunca vira meta:
 * a meta sai da régua por setor. O que o dono mexe é a verba; o sistema recalcula a meta.
 */
export function PedidoBlock({
  client,
  ladder,
  pedido,
  link,
  onSaved,
}: {
  client: BoardClient;
  ladder: ClientLadder | null;
  pedido: PlacarPedido | null;
  link: string | null;
  onSaved: () => void;
}) {
  const month = monthLabel(nextMonth());
  const roas = client.result_kind === "venda";
  const target = ladder ? targetOf(ladder) : null;
  const wanted = pedido?.wanted_value ?? null;
  // Verba que a régua pediria para o número do cliente: pedido × custo-alvo (venda: pedido ÷ retorno-alvo).
  // A régua também tem o teto de 50% sobre o que o cliente faz hoje (metas.ts), então a verba precisa cobrir os dois.
  const now = ladder?.read?.value ?? null;
  const byTarget = wanted !== null && target ? (roas ? wanted / target : wanted * target) : null;
  const byCap = wanted !== null && now ? (roas ? wanted / (now * CAP) : (wanted * now) / CAP) : null;
  const needed = byTarget === null ? null : Math.ceil(Math.max(byTarget, byCap ?? 0) / 10) * 10;

  const [budget, setBudget] = useState(needed !== null ? String(needed) : "");
  const [answer, setAnswer] = useState(pedido?.answer ?? "");
  const [pending, setPending] = useState<"verba" | "manter" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${link}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não deu para copiar. Selecione o endereço e copie à mão.", { description: `${window.location.origin}${link}` });
    }
  }

  async function respond(withBudget: boolean) {
    if (!pedido) return;
    setPending(withBudget ? "verba" : "manter");
    setError(null);
    const err = await send("/api/placar/pedido", "POST", withBudget ? { id: pedido.id, budget } : { id: pedido.id, answer });
    setPending(null);
    if (err) {
      setError(err);
      return;
    }
    toast.success(withBudget ? "Verba ajustada e meta recalculada" : "Resposta registrada", { description: `${client.name} · ${month}` });
    onSaved();
  }

  const wantedText = wanted !== null && pedido ? `${nf.format(wanted)} ${pedido.wanted_label}` : null;

  return (
    <section aria-label="Pedido do cliente" className="flex flex-col gap-3 border-t border-line pt-4">
      <div className="flex items-center justify-between gap-3">
        <Label as="p">Pedido do cliente para {month}</Label>
        {link && (
          <Button size="sm" variant="soft" onClick={copy} icon={copied ? <Check aria-hidden strokeWidth={1.75} /> : <Copy aria-hidden strokeWidth={1.75} />}>
            {copied ? "Copiado" : "Copiar link do pedido"}
          </Button>
        )}
      </div>

      {!pedido ? (
        <p className="type-body text-mute">O cliente ainda não respondeu. Mande o link pelo WhatsApp por volta do dia 25.</p>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-0.5">
              <dt className="type-label text-dim">Cliente pediu</dt>
              <dd className="type-subtitle tabular-nums text-fg">{wantedText ?? "sem número"}</dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="type-label text-dim">Meta da régua</dt>
              <dd className="type-subtitle tabular-nums text-fg">{metaText(client) ?? "sem meta"}</dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="type-label text-dim">Nota que ele deu ao mês</dt>
              <dd className="type-subtitle tabular-nums text-fg">{pedido.score === null ? "s/n" : nf.format(pedido.score)}</dd>
            </div>
            {needed !== null && target && (
              <div className="flex flex-col gap-0.5">
                <dt className="type-label text-dim">Verba para o pedido pela régua</dt>
                <dd className="type-subtitle tabular-nums text-fg" title={`${roas ? "retorno-alvo" : "custo-alvo"} ${fmtRead(roas ? "roas" : "custo", target)}; verba de hoje ${client.budget ? brl.format(client.budget) : "sem verba"}`}>
                  {brl.format(needed)}
                </dd>
              </div>
            )}
            {pedido.note && (
              <div className="col-span-2 flex flex-col gap-0.5">
                <dt className="type-label text-dim">O que muda no negócio dele</dt>
                <dd className="type-body text-fg">{pedido.note}</dd>
              </div>
            )}
          </dl>

          {pedido.answered_at ? (
            <Notice tone="info">{pedido.accepted ? pedido.answer : `Régua mantida. Resposta ao cliente: "${pedido.answer}"`}</Notice>
          ) : (
            <>
              <p className="type-caption text-mute">
                O pedido não vira meta. A meta sai da régua do setor; o que muda é a verba. Ajuste a verba e o sistema recalcula, ou mantenha e responda ao cliente.
              </p>
              <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
                <Field
                  id="pedido-verba"
                  label="Nova verba mensal (R$)"
                  type="text"
                  inputMode="decimal"
                  value={budget}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBudget(e.target.value)}
                  placeholder={client.budget ? nf.format(client.budget) : "0"}
                />
                <Field
                  id="pedido-resposta"
                  as="textarea"
                  label="Ou mantenha a régua e responda ao cliente"
                  hint="Diga o que seria preciso para chegar lá. Você manda pelo WhatsApp."
                  maxLength={500}
                  value={answer}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setAnswer(e.target.value)}
                />
              </div>
              {error && <Notice tone="bad">{error}</Notice>}
              <div className="flex flex-wrap justify-end gap-2">
                <Button size="sm" variant="soft" pending={pending === "manter"} disabled={pending !== null} onClick={() => respond(false)}>
                  Manter a régua e responder
                </Button>
                <Button size="sm" variant="primary" pending={pending === "verba"} disabled={pending !== null || !ladder} onClick={() => respond(true)}>
                  Ajustar a verba e recalcular
                </Button>
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
