"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { isNum, metaText, parseDecLoose, weekLabel } from "@/lib/placar/score";
import type { Audience, BoardClient, ClientKind, MetaMode, MetaPeriod, PlacarEntry } from "@/lib/placar/types";
import { btnDanger, btnGhost, btnPrimary, fieldInput, fieldLabel } from "./tones";

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

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className={fieldLabel}>
        {label}
      </label>
      {children}
      {hint && <span className="text-[12px] leading-snug text-zinc-500">{hint}</span>}
    </div>
  );
}

function Check({ id, checked, onChange, children }: { id: string; checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label htmlFor={id} className="flex items-start gap-2.5 text-[13.5px] leading-snug text-zinc-300">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 shrink-0 accent-[#00e5ff]"
      />
      <span>{children}</span>
    </label>
  );
}

function Shell({ open, onClose, title, sub, children }: { open: boolean; onClose: () => void; title: string; sub?: string; children: ReactNode }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-4 overflow-y-auto border border-white/10 bg-[#121212] p-5 ring-0 sm:max-w-[520px]">
        <div className="flex flex-col gap-1.5 pr-8">
          <DialogTitle className="text-[18px] font-bold leading-tight tracking-tight text-white">{title}</DialogTitle>
          {sub && <DialogDescription className="text-[13px] text-zinc-500">{sub}</DialogDescription>}
        </div>
        {children}
      </DialogContent>
    </Dialog>
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
    <Shell
      open={!!client}
      onClose={onClose}
      title={client ? `Lançar: ${client.name}` : "Lançar"}
      sub={client ? `Semana de ${weekLabel(week)}${metaText(client) ? ` · meta ${metaText(client)}` : ""}` : undefined}
    >
      {client && (
        // A chave recria o formulário a cada abertura. O polling de 30 s não
        // passa por aqui, então o que está digitado não some.
        <EntryForm key={`${client.id}_${week}`} client={client} week={week} entry={entry} apiBase={apiBase} onClose={onClose} onSaved={onSaved} />
      )}
    </Shell>
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
  const [busy, setBusy] = useState(false);
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
    setBusy(true);
    const e = await send(`${apiBase}/entries`, "PUT", body);
    setBusy(false);
    if (e) return setErr(e);
    toast.success("Lançamento salvo");
    onSaved();
    onClose();
  }

  async function remove() {
    if (!confirmDel) return setConfirmDel(true);
    setBusy(true);
    const e = await send(`${apiBase}/entries?client=${encodeURIComponent(client.id)}&week=${week}`, "DELETE");
    setBusy(false);
    if (e) return setErr(e);
    toast.success("Lançamento apagado");
    onSaved();
    onClose();
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      {!proj && (
        <Field
          label={valueLabel}
          htmlFor="e-value"
          hint={metaText(client) ? undefined : "Este cliente ainda não tem meta. O número fica guardado, mas a nota só sai quando a meta for combinada."}
        >
          <input id="e-value" type="text" inputMode="decimal" autoComplete="off" value={value} onChange={(e) => setValue(e.target.value)} className={fieldInput} />
        </Field>
      )}
      {!proj && !rate && (
        <Check id="e-month" checked={month} onChange={setMonth}>
          Este número é do mês inteiro e vale pelas 4 semanas até esta
        </Check>
      )}
      {proj && (
        <Field label="O marco desta semana saiu no prazo?" htmlFor="e-ms">
          <select id="e-ms" value={ms} onChange={(e) => setMs(e.target.value)} className={fieldInput}>
            <option value="">Não informado</option>
            <option value="sim">Sim, no prazo</option>
            <option value="nao">Não, atrasou</option>
          </select>
        </Field>
      )}
      <Field label="Nota que o cliente deu (0 a 10)" htmlFor="e-cs" hint="Uma vez por mês. Vale por 5 semanas.">
        <input id="e-cs" type="text" inputMode="decimal" autoComplete="off" value={cs} onChange={(e) => setCs(e.target.value)} className={fieldInput} />
      </Field>
      <Field label="O que aconteceu" htmlFor="e-note">
        <textarea
          id="e-note"
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ex.: 2 matrículas, campanha nova subiu na quarta"
          className={`${fieldInput} min-h-[72px] resize-y`}
        />
      </Field>
      {err && (
        <p role="alert" className="text-[13px] text-red-400">
          {err}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {entry && (
          <button type="button" onClick={remove} disabled={busy} className={btnDanger}>
            {confirmDel ? "Confirmar: apagar" : "Apagar lançamento"}
          </button>
        )}
        <span className="flex-1" />
        <button type="button" onClick={onClose} className={btnGhost}>
          Cancelar
        </button>
        <button type="submit" disabled={busy} className={btnPrimary}>
          {busy ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </form>
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
    <Shell open={open} onClose={onClose} title={client ? `Editar: ${client.name}` : "Novo cliente"}>
      {open && (
        <ClientForm key={client?.id ?? "__new"} client={client} audience={audience} owners={owners} apiBase={apiBase} onClose={onClose} onSaved={onSaved} />
      )}
    </Shell>
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
    const e = client
      ? await send(`${apiBase}/clients`, "PATCH", { id: client.id, ...body })
      : await send(`${apiBase}/clients`, "POST", body);
    setBusy(false);
    if (e) return setErr(e);
    toast.success("Cliente salvo");
    onSaved();
    onClose();
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <Field label="Nome" htmlFor="c-name">
        <input id="c-name" type="text" autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} className={fieldInput} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Dono" htmlFor="c-owner">
          <input id="c-owner" type="text" list="placar-owner-list" autoComplete="off" placeholder="Sem dono" value={owner} onChange={(e) => setOwner(e.target.value)} className={fieldInput} />
          <datalist id="placar-owner-list">
            {owners.map((o) => (
              <option key={o} value={o} />
            ))}
          </datalist>
        </Field>
        {finance && (
          <Field label="Mensalidade (R$)" htmlFor="c-fee">
            <input id="c-fee" type="text" inputMode="decimal" autoComplete="off" value={fee} onChange={(e) => setFee(e.target.value)} className={fieldInput} />
          </Field>
        )}
      </div>
      <Check id="c-owner-ok" checked={ownerOk} onChange={setOwnerOk}>
        Dono confirmado na reunião
      </Check>
      <Field label="O que a COB entrega" htmlFor="c-delivers">
        <input id="c-delivers" type="text" autoComplete="off" value={delivers} onChange={(e) => setDelivers(e.target.value)} className={fieldInput} />
      </Field>
      <Field label="Tipo" htmlFor="c-kind">
        <select id="c-kind" value={kind} onChange={(e) => setKind(e.target.value as ClientKind)} className={fieldInput}>
          <option value="resultado">Recorrente, nota pelo resultado</option>
          <option value="projeto">Projeto, nota pelo marco no prazo</option>
        </select>
      </Field>
      {kind !== "projeto" && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Meta (número)" htmlFor="c-meta-value">
              <input id="c-meta-value" type="text" inputMode="decimal" autoComplete="off" value={metaValue} onChange={(e) => setMetaValue(e.target.value)} className={fieldInput} />
            </Field>
            <Field label="Do quê" htmlFor="c-meta-label">
              <input id="c-meta-label" type="text" autoComplete="off" placeholder="vendas, matrículas, R$ em vendas" value={metaLabel} onChange={(e) => setMetaLabel(e.target.value)} className={fieldInput} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Por" htmlFor="c-meta-period">
              <select id="c-meta-period" value={metaPeriod} onChange={(e) => setMetaPeriod(e.target.value as MetaPeriod)} className={fieldInput}>
                <option value="mes">mês</option>
                <option value="semana">semana</option>
                <option value="dia">dia</option>
              </select>
            </Field>
            <Field label="Tipo de meta" htmlFor="c-meta-mode">
              <select id="c-meta-mode" value={metaMode} onChange={(e) => setMetaMode(e.target.value as MetaMode)} className={fieldInput}>
                <option value="soma">Quantidade (soma)</option>
                <option value="taxa">Taxa, maior é melhor (ROAS)</option>
                <option value="custo">Custo, menor é melhor (CPA)</option>
              </select>
            </Field>
          </div>
        </>
      )}
      <Field label="Observação da meta" htmlFor="c-meta-note">
        <input id="c-meta-note" type="text" autoComplete="off" value={metaNote} onChange={(e) => setMetaNote(e.target.value)} className={fieldInput} />
      </Field>
      <Check id="c-meta-review" checked={metaReview} onChange={setMetaReview}>
        Meta precisa ser revisada com o cliente
      </Check>
      <Check id="c-active" checked={active} onChange={setActive}>
        Cliente ativo (desmarque para tirar do placar)
      </Check>
      {err && (
        <p role="alert" className="text-[13px] text-red-400">
          {err}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button type="button" onClick={onClose} className={btnGhost}>
          Cancelar
        </button>
        <button type="submit" disabled={busy} className={btnPrimary}>
          {busy ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </form>
  );
}
