"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { Button, Field, Modal, Notice } from "@/components/ui";
import { isNum, metaText, parseDecLoose, weekLabel } from "@/lib/placar/score";
import type { Audience, BoardClient, ClientKind, MetaMode, MetaPeriod, PlacarEntry } from "@/lib/placar/types";

/** Envia JSON e devolve a mensagem de erro do servidor, ou null quando deu certo. */
export async function send(url: string, method: string, body?: unknown): Promise<string | null> {
  try {
    const res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data?.ok) return null;
    if (res.status === 401) return "Sua sessão expirou. Recarregue a página e entre de novo.";
    return data?.error ?? `Não deu para salvar agora (erro ${res.status}). Tente de novo em instantes.`;
  } catch {
    return "Sem conexão com o servidor. Tente de novo em instantes.";
  }
}

const decText = (n: number | null | undefined) => (isNum(n) ? String(n).replace(".", ",") : "");

function Check({ id, checked, onChange, children }: { id: string; checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label htmlFor={id} className="flex items-start gap-2.5 type-body text-mute">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-accent" />
      <span>{children}</span>
    </label>
  );
}

// ---------- Lançar ----------

export function EntryDialog({
  client,
  week,
  entry,
  apiBase,
  onClose,
  onSaved,
}: {
  client: BoardClient | null;
  week: string;
  entry: PlacarEntry | undefined;
  apiBase: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  return (
    // A chave recria o formulário a cada abertura. O polling de 30 s não passa por aqui, então o que está digitado não some.
    client && (
      <EntryForm key={`${client.id}_${week}`} client={client} week={week} entry={entry} apiBase={apiBase} onClose={onClose} onSaved={onSaved} />
    )
  );
}

function EntryForm({
  client,
  week,
  entry,
  apiBase,
  onClose,
  onSaved,
}: {
  client: BoardClient;
  week: string;
  entry: PlacarEntry | undefined;
  apiBase: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const proj = client.kind === "projeto";
  const rate = client.meta_mode === "taxa" || client.meta_mode === "custo";
  const [value, setValue] = useState(decText(entry?.value));
  const [month, setMonth] = useState(!!entry && entry.weeks > 1);
  const [ms, setMs] = useState(entry && typeof entry.milestone === "boolean" ? (entry.milestone ? "sim" : "nao") : "");
  const [cs, setCs] = useState(decText(entry?.client_score));
  const [note, setNote] = useState(entry?.note ?? "");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);

  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const valueLabel = rate ? `${client.meta_label || "Valor"} na semana` : `${client.meta_label ? cap(client.meta_label) : "Resultado"} na semana`;

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    setErr("");
    const body: Record<string, unknown> = { client: client.id, week, weeks: 1 };
    if (proj) {
      if (ms) body.milestone = ms === "sim";
    } else {
      const v = parseDecLoose(value);
      if (Number.isNaN(v)) return setErr("O resultado precisa ser um número, por exemplo 4 ou 2,5.");
      if (v !== null) body.value = v;
      if (month && !rate) body.weeks = 4;
    }
    const c = parseDecLoose(cs);
    if (Number.isNaN(c) || (c !== null && (c < 0 || c > 10))) return setErr("A nota do cliente vai de 0 a 10.");
    if (c !== null) body.client_score = c;
    if (note.trim()) body.note = note.trim();
    if (!("value" in body) && !("milestone" in body) && !("client_score" in body)) {
      return setErr("Preencha o resultado, o marco ou a nota do cliente.");
    }
    setBusy("save");
    const e = await send(`${apiBase}/entries`, "PUT", body);
    setBusy(null);
    if (e) return setErr(e);
    toast.success("Lançamento salvo", { description: `${client.name} · ${weekLabel(week)}` });
    onSaved();
    onClose();
  }

  async function remove() {
    setBusy("delete");
    const e = await send(`${apiBase}/entries?client=${encodeURIComponent(client.id)}&week=${week}`, "DELETE");
    setBusy(null);
    setConfirmDel(false);
    if (e) return setErr(e);
    toast.success("Lançamento apagado");
    onSaved();
    onClose();
  }

  return (
    <>
      <Modal
        open
        onClose={onClose}
        title={`Lançar: ${client.name}`}
        description={`Semana de ${weekLabel(week)}${metaText(client) ? ` · meta ${metaText(client)}` : ""}`}
        footer={
          <>
            {entry && (
              <Button variant="danger" onClick={() => setConfirmDel(true)} disabled={busy !== null} className="mr-auto">
                Apagar lançamento
              </Button>
            )}
            <Button onClick={onClose}>Cancelar</Button>
            <Button type="submit" form="placar-entry-form" variant="primary" pending={busy === "save"} disabled={busy !== null}>
              Salvar
            </Button>
          </>
        }
      >
        <form id="placar-entry-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
          {!proj && (
            <Field
              id="e-value"
              label={valueLabel}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={value}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setValue(e.target.value)}
              hint={metaText(client) ? undefined : "Este cliente ainda não tem meta. O número fica guardado, mas a nota só sai quando a meta for combinada."}
            />
          )}
          {!proj && !rate && (
            <Check id="e-month" checked={month} onChange={setMonth}>
              Este número é do mês inteiro e vale pelas 4 semanas até esta
            </Check>
          )}
          {proj && (
            <Field id="e-ms" label="O marco desta semana saiu no prazo?" as="select" value={ms} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setMs(e.target.value)}>
              <option value="">Não informado</option>
              <option value="sim">Sim, no prazo</option>
              <option value="nao">Não, atrasou</option>
            </Field>
          )}
          <Field
            id="e-cs"
            label="Nota que o cliente deu (0 a 10)"
            hint="Uma vez por mês. Vale por 5 semanas."
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={cs}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCs(e.target.value)}
          />
          <Field
            id="e-note"
            label="O que aconteceu"
            as="textarea"
            rows={3}
            value={note}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNote(e.target.value)}
            placeholder="Ex.: 2 matrículas, campanha nova subiu na quarta"
          />
          {err && <Notice tone="bad">{err}</Notice>}
        </form>
      </Modal>

      <Modal
        open={confirmDel}
        onClose={() => setConfirmDel(false)}
        size="sm"
        title="Apagar o lançamento?"
        description={`${client.name}, semana de ${weekLabel(week)}. A nota desta semana volta a ser calculada sem ele.`}
        footer={
          <>
            <Button onClick={() => setConfirmDel(false)}>Cancelar</Button>
            <Button variant="danger" onClick={remove} pending={busy === "delete"}>
              Apagar
            </Button>
          </>
        }
      />
    </>
  );
}

// ---------- Editar / Novo cliente ----------

export function ClientDialog({
  open,
  client,
  audience,
  owners,
  apiBase,
  onClose,
  onSaved,
}: {
  open: boolean;
  client: BoardClient | null;
  audience: Audience;
  owners: string[];
  apiBase: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  return (
    open && <ClientForm key={client?.id ?? "__new"} client={client} audience={audience} owners={owners} apiBase={apiBase} onClose={onClose} onSaved={onSaved} />
  );
}

function ClientForm({
  client,
  audience,
  owners,
  apiBase,
  onClose,
  onSaved,
}: {
  client: BoardClient | null;
  audience: Audience;
  owners: string[];
  apiBase: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const finance = audience === "finance";
  const [name, setName] = useState(client?.name ?? "");
  const [owner, setOwner] = useState(client?.owner ?? "");
  const [ownerOk, setOwnerOk] = useState(!!client?.owner_ok);
  const [fee, setFee] = useState(decText(client?.fee));
  const [delivers, setDelivers] = useState(client?.delivers ?? "");
  const [kind, setKind] = useState<ClientKind>(client?.kind ?? "resultado");
  const [metaValue, setMetaValue] = useState(client && Number(client.meta_value) > 0 ? decText(client.meta_value) : "");
  const [metaLabel, setMetaLabel] = useState(client?.meta_label ?? "");
  const [metaPeriod, setMetaPeriod] = useState<MetaPeriod>(client?.meta_period ?? "mes");
  const [metaMode, setMetaMode] = useState<MetaMode>(client?.meta_mode ?? "soma");
  const [metaNote, setMetaNote] = useState(client?.meta_note ?? "");
  const [metaReview, setMetaReview] = useState(!!client?.meta_review);
  const [active, setActive] = useState(client ? client.active !== false : true);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const text = (set: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => set(e.target.value);

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    setErr("");
    if (!name.trim()) return setErr("Dê um nome ao cliente.");
    const mv = parseDecLoose(metaValue);
    if (Number.isNaN(mv) || (mv !== null && mv <= 0)) return setErr("A meta precisa ser um número maior que zero.");
    const body: Record<string, unknown> = {
      name: name.trim(),
      owner: owner.trim(),
      owner_ok: ownerOk,
      delivers: delivers.trim(),
      kind,
      meta_value: mv,
      meta_label: metaLabel.trim(),
      meta_period: metaPeriod,
      meta_mode: metaMode,
      meta_note: metaNote.trim(),
      meta_review: metaReview,
      active,
    };
    if (finance) {
      const f = parseDecLoose(fee);
      if (Number.isNaN(f) || (f !== null && f < 0)) return setErr("A mensalidade precisa ser um número, por exemplo 2500.");
      body.fee = f;
    }
    setBusy(true);
    const e = client ? await send(`${apiBase}/clients`, "PATCH", { id: client.id, ...body }) : await send(`${apiBase}/clients`, "POST", body);
    setBusy(false);
    if (e) return setErr(e);
    toast.success("Cliente salvo", { description: name.trim() });
    onSaved();
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={client ? `Editar: ${client.name}` : "Novo cliente"}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button type="submit" form="placar-client-form" variant="primary" pending={busy}>
            Salvar
          </Button>
        </>
      }
    >
      <form id="placar-client-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Field id="c-name" label="Nome" type="text" autoComplete="off" value={name} onChange={text(setName)} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Field id="c-owner" label="Dono" type="text" list="placar-owner-list" autoComplete="off" placeholder="Sem dono" value={owner} onChange={text(setOwner)} />
            <datalist id="placar-owner-list">
              {owners.map((o) => (
                <option key={o} value={o} />
              ))}
            </datalist>
          </div>
          {finance && <Field id="c-fee" label="Mensalidade (R$)" type="text" inputMode="decimal" autoComplete="off" value={fee} onChange={text(setFee)} />}
        </div>
        <Check id="c-owner-ok" checked={ownerOk} onChange={setOwnerOk}>
          Dono confirmado na reunião
        </Check>
        <Field id="c-delivers" label="O que a COB entrega" type="text" autoComplete="off" value={delivers} onChange={text(setDelivers)} />
        <Field id="c-kind" label="Tipo" as="select" value={kind} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setKind(e.target.value as ClientKind)}>
          <option value="resultado">Recorrente, nota pelo resultado</option>
          <option value="projeto">Projeto, nota pelo marco no prazo</option>
        </Field>
        {kind !== "projeto" && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="c-meta-value" label="Meta (número)" type="text" inputMode="decimal" autoComplete="off" value={metaValue} onChange={text(setMetaValue)} />
              <Field id="c-meta-label" label="Do quê" type="text" autoComplete="off" placeholder="vendas, matrículas, R$ em vendas" value={metaLabel} onChange={text(setMetaLabel)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="c-meta-period" label="Por" as="select" value={metaPeriod} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setMetaPeriod(e.target.value as MetaPeriod)}>
                <option value="mes">mês</option>
                <option value="semana">semana</option>
                <option value="dia">dia</option>
              </Field>
              <Field id="c-meta-mode" label="Tipo de meta" as="select" value={metaMode} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setMetaMode(e.target.value as MetaMode)}>
                <option value="soma">Quantidade (soma)</option>
                <option value="taxa">Taxa, maior é melhor (ROAS)</option>
                <option value="custo">Custo, menor é melhor (CPA)</option>
              </Field>
            </div>
          </>
        )}
        <Field id="c-meta-note" label="Observação da meta" type="text" autoComplete="off" value={metaNote} onChange={text(setMetaNote)} />
        <Check id="c-meta-review" checked={metaReview} onChange={setMetaReview}>
          Meta precisa ser revisada com o cliente
        </Check>
        <Check id="c-active" checked={active} onChange={setActive}>
          Cliente ativo (desmarque para tirar do placar)
        </Check>
        {err && <Notice tone="bad">{err}</Notice>}
      </form>
    </Modal>
  );
}
