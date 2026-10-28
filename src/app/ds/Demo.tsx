"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Bar, Button, Empty, Field, Metric, Modal, Notice, PlayerLevel, Score, SectionTitle, Skeleton, Surface, Trail } from "@/components/ui";
import { levelFor } from "@/lib/placar/rodada-rules";
import type { Tone } from "@/lib/placar/score";

const TONES: Tone[] = ["good", "warn", "bad", "none"];
const TRAIL: Tone[] = ["good", "good", "warn", "good", "good", "good", "bad", "good"];
const SCORES = [7, 8, 5, 9, 8.5, 10, 2, 9.2];

/** Dado vivo: troca de valor para provar que o número desliza, e 42 anéis para provar que o scroll não trava. */
export function Demo() {
  const [alt, setAlt] = useState(false);
  const [open, setOpen] = useState<"sm" | "md" | null>(null);
  const v = alt ? { red: 3, avg: 7.4, green: 29, xp: 212, score: 7.9 } : { red: 6, avg: 6.8, green: 24, xp: 140, score: 9.2 };
  return (
    <>
      <section className="flex flex-col gap-4">
        <SectionTitle
          title="Métrica, anel, trilha e barra"
          hint="O número conta uma vez e depois desliza. Troque os valores para ver."
          right={<Button variant="soft" size="sm" onClick={() => setAlt((a) => !a)}>Trocar valores</Button>}
        />
        <div className="grid gap-3 sm:grid-cols-4">
          <Surface className="p-4"><Metric size="lg" value={v.red} label="No vermelho" sub="de 42" tone="bad" delta={{ value: alt ? -3 : 3, label: alt ? "3 a menos" : "3 a mais" }} /></Surface>
          <Surface className="p-4"><Metric value={v.avg} label="Nota média da carteira" sub="meta do time 7,0" /></Surface>
          <Surface className="p-4"><Metric value={v.green} unit={`${Math.round((v.green / 42) * 100)}%`} label="No verde" sub="meta de janeiro 70%" tone="good" /></Surface>
          <Surface className="p-4"><Metric value={null} label="Nota média" sub="0 de 42 com nota" /></Surface>
        </div>
        <Surface className="flex flex-wrap items-center gap-6 p-5">
          {TONES.map((t) => (
            <Score key={t} value={t === "none" ? null : v.score - TONES.indexOf(t) * 2.5} tone={t} size={40} />
          ))}
          <Score value={v.score} tone="good" size={32} />
          <Score value={v.score} tone="good" size={56} />
          <Score value={(v.green / 42) * 10} tone="warn" size={56} label={`${v.green} de 42 no verde`} />
          <Trail tones={TRAIL} scores={SCORES} />
          <Trail tones={TRAIL} scores={SCORES} size="md" />
          <div className="flex w-64 flex-col gap-3">
            <Bar value={v.green} max={42} marker={42 * 0.7} tone="good" size="md" label="no verde contra a meta" />
            <Bar value={v.red} max={42} tone="bad" />
            <PlayerLevel xp={v.xp} level={levelFor(v.xp)} />
            <PlayerLevel xp={430} level={levelFor(430)} size="md" />
          </div>
        </Surface>
      </section>

      <section className="flex flex-col gap-4">
        <SectionTitle
          title="Modal, toast, aviso, vazio e esqueleto"
          hint="Um modal (folha no celular), um toast, um aviso em três tons."
          right={
            <>
              <Button size="sm" onClick={() => setOpen("sm")}>Modal sm</Button>
              <Button size="sm" onClick={() => setOpen("md")}>Modal md</Button>
              <Button size="sm" variant="soft" onClick={() => toast.success("Lançado", { description: "Green Paradise · 182 contatos" })}>Toast</Button>
            </>
          }
        />
        <div className="grid gap-3 sm:grid-cols-3">
          <Notice tone="info" title="Dados locais de desenvolvimento">Nada daqui chega ao time.</Notice>
          <Notice tone="warn" title="Falta configurar antes de emitir" action={<Button size="sm">Ver</Button>}>ASAAS_API_KEY não configurada.</Notice>
          <Notice tone="bad" title="Não deu para ler o placar" action={<Button size="sm" variant="danger">Tentar de novo</Button>}>O servidor respondeu 500.</Notice>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Empty title="Nenhum cliente no placar" text="Cadastre o primeiro para começar a lançar números." action={<Button variant="primary">Novo cliente</Button>} />
          <Surface className="flex flex-col gap-4 p-4">
            <div className="flex gap-3"><Skeleton shape="ring" /><Skeleton lines={2} className="flex-1" /></div>
            <Skeleton shape="metric" />
            <Skeleton shape="row" />
          </Surface>
        </div>
        <Modal
          open={open !== null}
          onClose={() => setOpen(null)}
          size={open ?? "md"}
          title={open === "sm" ? "Apagar Vale das Nuvens?" : "Lançar: Green Paradise"}
          description={open === "sm" ? "Some do placar e das rodadas futuras. As rodadas fechadas ficam." : "Semana de 19/10 a 25/10"}
          footer={
            <>
              <Button onClick={() => setOpen(null)}>Cancelar</Button>
              <Button variant={open === "sm" ? "danger" : "primary"} onClick={() => setOpen(null)}>{open === "sm" ? "Apagar" : "Salvar"}</Button>
            </>
          }
        >
          {open === "md" && (
            <div className="flex flex-col gap-4">
              <Field id="demo-res" label="Resultado na semana" placeholder="Ex.: 182" inputMode="decimal" hint="Este cliente ainda não tem meta. O número fica guardado." />
              <Field id="demo-obs" label="O que aconteceu" as="textarea" placeholder="Ex.: 2 matrículas, campanha nova subiu na quarta" />
            </div>
          )}
        </Modal>
      </section>

      <section className="flex flex-col gap-4">
        <SectionTitle title="42 anéis" hint="A lista do Placar inteira. O scroll tem de ficar abaixo de 16ms por quadro." />
        <ul className="flex flex-col gap-1.5">
          {Array.from({ length: 42 }, (_, i) => (
            <Surface as="li" interactive key={i} className="flex items-center gap-3 px-3 py-2">
              <Score value={((i * 7) % 11) || null} tone={TONES[i % 4]} size={40} />
              <span className="type-subtitle text-fg">Cliente {i + 1}</span>
              <Trail tones={TRAIL} scores={SCORES} className="ml-auto" />
            </Surface>
          ))}
        </ul>
      </section>
    </>
  );
}
