"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button, Field, Label, Notice } from "@/components/ui";
import { metaText } from "@/lib/placar/score";
import { monthLabel, nextMonth } from "@/lib/placar/pedido-shared";
import type { BoardClient, PlacarPedido } from "@/lib/placar/types";
import { send } from "./PlacarDialogs";

const nf = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

/**
 * Bloco "Pedido do cliente" na ficha (docs/placar-pedido-cliente.md): o link para o dono
 * copiar e, quando o cliente respondeu, o pedido ao lado da meta com as duas saídas.
 */
export function PedidoBlock({
  client,
  pedido,
  link,
  onSaved,
}: {
  client: BoardClient;
  pedido: PlacarPedido | null;
  link: string | null;
  onSaved: () => void;
}) {
  const month = monthLabel(nextMonth());
  const [answer, setAnswer] = useState(pedido?.answer ?? "");
  const [pending, setPending] = useState<"aceitar" | "manter" | null>(null);
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

  async function respond(accepted: boolean) {
    if (!pedido) return;
    setPending(accepted ? "aceitar" : "manter");
    setError(null);
    const err = await send("/api/placar/pedido", "POST", { id: pedido.id, accepted, answer });
    setPending(null);
    if (err) {
      setError(err);
      return;
    }
    toast.success(accepted ? "Pedido aceito como meta" : "Resposta registrada", { description: `${client.name} · ${month}` });
    onSaved();
  }

  const wanted = pedido && pedido.wanted_value !== null ? `${nf.format(pedido.wanted_value)} ${pedido.wanted_label}` : null;

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
              <dd className="type-subtitle tabular-nums text-fg">{wanted ?? "sem número"}</dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="type-label text-dim">Meta da régua</dt>
              <dd className="type-subtitle tabular-nums text-fg">{metaText(client) ?? "sem meta"}</dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="type-label text-dim">Nota que ele deu ao mês</dt>
              <dd className="type-subtitle tabular-nums text-fg">{pedido.score === null ? "s/n" : nf.format(pedido.score)}</dd>
            </div>
            {pedido.note && (
              <div className="col-span-2 flex flex-col gap-0.5">
                <dt className="type-label text-dim">O que muda no negócio dele</dt>
                <dd className="type-body text-fg">{pedido.note}</dd>
              </div>
            )}
          </dl>

          {pedido.answered_at ? (
            <Notice tone="info">
              {pedido.accepted ? "Pedido aceito como meta." : `Régua mantida. Resposta ao cliente: "${pedido.answer}"`}
            </Notice>
          ) : (
            <>
              <Field
                id="pedido-resposta"
                as="textarea"
                label="Se mantiver a régua, o que você responde ao cliente?"
                hint="Diga o que seria preciso para chegar lá: verba, custo ou prazo. Você manda pelo WhatsApp."
                maxLength={500}
                value={answer}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setAnswer(e.target.value)}
              />
              {error && <Notice tone="bad">{error}</Notice>}
              <div className="flex flex-wrap justify-end gap-2">
                <Button size="sm" variant="soft" pending={pending === "manter"} disabled={pending !== null} onClick={() => respond(false)}>
                  Manter a régua e responder
                </Button>
                <Button size="sm" variant="primary" pending={pending === "aceitar"} disabled={pending !== null || wanted === null} onClick={() => respond(true)}>
                  Aceitar como meta
                </Button>
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
