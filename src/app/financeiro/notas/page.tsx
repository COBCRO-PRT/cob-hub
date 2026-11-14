import { FileText, Send } from "lucide-react";
import { Button, CONTAINER, Empty, Field, Label, Notice, Pill, Surface, type PillTone } from "@/components/ui";
import { PageHeader } from "@/components/placar/PageHeader";
import { cn } from "@/lib/utils";
import { emProducao, pendenciasDaConfiguracao } from "@/lib/nf/config";
import {
  competenciaAtual,
  montarLote,
  rotuloDaCompetencia,
  type Competencia,
  type LinhaDoLote,
  type SituacaoLinha,
} from "@/lib/nf/lote";
import type { Enquadramento } from "@/lib/nf/simples";
import { emitirLinha, emitirPendentes } from "./acoes";
import { CancelarNota } from "./CancelarNota";
import { Kpi } from "./Kpi";
import { SubmitButton } from "./SubmitButton";

export const metadata = {
  title: "Notas do mês · Colombo Media Hub",
  robots: { index: false, follow: false },
};

// Nota fiscal não pode vir de cache: o que está emitido muda a cada clique.
export const dynamic = "force-dynamic";

const real = (valor: number) =>
  valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const numero = (valor: number) =>
  valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const SELO: Record<SituacaoLinha, { texto: string; tone: PillTone }> = {
  pendente: { texto: "a emitir", tone: "neutral" },
  emitida: { texto: "emitida", tone: "good" },
  processando: { texto: "na fila", tone: "warn" },
  cancelada: { texto: "cancelada", tone: "none" },
  erro: { texto: "erro", tone: "bad" },
};

/** Campo de tabela: o `Field` traz rótulo visível, que numa célula vira ruído. */
const CELL_INPUT =
  "rounded-sm border border-line bg-surface-2 text-base text-fg shadow-relief outline-none motion-safe:transition-colors placeholder:text-dim hover:border-line-strong focus:border-accent focus:ring-2 focus:ring-accent-soft sm:text-sm";

const CHIP = "rounded-sm border px-1.5 py-0.5 type-caption";

/**
 * Doze meses para trás e um para a frente. A competência pedida pela URL entra
 * mesmo fora da janela, pra não sumir do seletor o que a tela está mostrando.
 */
function opcoesDeCompetencia(selecionada: Competencia): Competencia[] {
  const hoje = new Date();
  const lista: Competencia[] = [];
  for (let delta = 1; delta >= -12; delta--) {
    lista.push(competenciaAtual(new Date(hoje.getFullYear(), hoje.getMonth() + delta, 1)));
  }
  if (!lista.includes(selecionada)) lista.push(selecionada);
  return lista.sort().reverse();
}

function Linha({ linha }: { linha: LinhaDoLote }) {
  const selo = SELO[linha.situacao];
  const nome = linha.cliente?.name ?? linha.assinatura.customer;
  // O id costura os campos espalhados na linha ao mesmo form, já que <tr> não
  // pode ser embrulhado por <form> em HTML válido.
  const formId = `emitir-${linha.referencia}`;
  const travada = linha.bloqueios.length > 0;
  // Recusada ou cancelada volta a ser emitível: a referência ficou livre e a
  // trava de duplicata em emitirNota() é quem impede sair duas vezes.
  const podeEmitir =
    linha.situacao === "pendente" || linha.situacao === "erro" || linha.situacao === "cancelada";
  const reemissao = podeEmitir && linha.situacao !== "pendente";

  return (
    <tr className="h-12 even:bg-surface-2 motion-safe:transition-colors hover:bg-surface-3 [&>td]:py-2 [&>td]:align-middle">
      <td className="pl-5 pr-4">
        <div className="type-body font-medium text-fg">{nome}</div>
        <div className="mt-0.5 font-mono type-caption text-dim">{linha.referencia}</div>
        {travada && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {linha.bloqueios.map((bloqueio) => (
              <span key={bloqueio} className={cn(CHIP, "border-bad/35 bg-bad/12 text-bad")}>
                {bloqueio}
              </span>
            ))}
          </div>
        )}

        {linha.situacao === "erro" && linha.nota?.statusDescription && (
          <div className="mt-2 rounded-sm border border-bad/35 bg-bad/12 px-2 py-1.5 type-caption text-bad">
            <span className="font-semibold">Recusada pela prefeitura: </span>
            {linha.nota.statusDescription}
          </div>
        )}
        {linha.avisos.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {linha.avisos.map((aviso) => (
              <span key={aviso} className={cn(CHIP, "border-warn/35 bg-warn/12 text-warn")}>
                {aviso}
              </span>
            ))}
          </div>
        )}
      </td>

      <td className="pr-4">
        {podeEmitir ? (
          <input
            type="text"
            name="descricao"
            form={formId}
            defaultValue={linha.descricao}
            aria-label={`Descrição do serviço de ${nome}`}
            className={cn(CELL_INPUT, "w-full min-w-[220px] px-3 py-1.5")}
          />
        ) : (
          <span className="type-body text-mute">{linha.descricao}</span>
        )}
      </td>

      <td className="pr-4">
        {podeEmitir ? (
          <div
            className={cn(
              CELL_INPUT,
              "flex items-center justify-end gap-1.5 px-3 py-1.5 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent-soft",
            )}
          >
            <span className="text-xs text-dim">R$</span>
            <input
              type="number"
              name="valor"
              form={formId}
              step="0.01"
              min="0.01"
              defaultValue={linha.valor}
              aria-label={`Valor da nota de ${nome}`}
              className="w-[86px] bg-transparent text-right tabular-nums text-fg outline-none"
            />
          </div>
        ) : (
          <div className="pr-3 text-right type-body tabular-nums text-mute">{numero(linha.valor)}</div>
        )}

        {linha.imposto !== null && linha.liquido !== null && (
          <div className="mt-1.5 pr-3 text-right type-caption tabular-nums text-dim">
            <span className="text-warn">-{numero(linha.imposto)}</span>
            {" imposto"}
            <br />
            <span className="text-mute">{numero(linha.liquido)}</span>
            {" líquido"}
          </div>
        )}
      </td>

      <td className="pr-4">
        <Pill tone={selo.tone}>{selo.texto}</Pill>
        {linha.nota?.number && (
          <div className="mt-1 font-mono type-caption text-dim">nº {linha.nota.number}</div>
        )}
      </td>

      <td className="pr-5 text-right">
        {podeEmitir && travada && <span className="type-caption text-bad">cadastro incompleto</span>}

        {podeEmitir && !travada && (
          <form action={emitirLinha} id={formId}>
            <input type="hidden" name="clienteId" value={linha.cliente?.id ?? ""} />
            <input type="hidden" name="referencia" value={linha.referencia} />
            <SubmitButton size="sm">{reemissao ? "Emitir de novo" : "Emitir"}</SubmitButton>
          </form>
        )}

        {linha.nota && linha.situacao !== "cancelada" && (
          <div className="flex items-center justify-end gap-3">
            {linha.nota.pdfUrl && (
              <a
                href={linha.nota.pdfUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-sm text-xs font-semibold text-mute underline underline-offset-4 outline-none motion-safe:transition-colors hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent [&_svg]:size-3.5"
              >
                <FileText aria-hidden strokeWidth={1.75} />
                PDF
              </a>
            )}
            <CancelarNota
              notaId={linha.nota.id}
              numero={linha.nota.number}
              valor={real(linha.nota.value)}
              cliente={nome}
            />
          </div>
        )}
      </td>
    </tr>
  );
}

export default async function Notas({
  searchParams,
}: {
  searchParams: Promise<{ competencia?: string }>;
}) {
  const params = await searchParams;
  const competencia: Competencia = /^\d{4}-\d{2}$/.test(params.competencia ?? "")
    ? (params.competencia as Competencia)
    : competenciaAtual();

  const pendencias = pendenciasDaConfiguracao();
  const semChave = !process.env.ASAAS_API_KEY;

  let lote: LinhaDoLote[] = [];
  let enquadramento: Enquadramento | null = null;
  let falha: string | null = null;

  if (!semChave) {
    try {
      const resultado = await montarLote(competencia);
      lote = resultado.linhas;
      enquadramento = resultado.enquadramento;
    } catch (erro) {
      falha = erro instanceof Error ? erro.message : String(erro);
    }
  }

  // Ordem alfabética: a API devolve em ordem de criação, que não ajuda ninguém
  // a procurar um cliente no meio de trinta e tantas linhas.
  lote.sort((a, b) =>
    (a.cliente?.name ?? "").localeCompare(b.cliente?.name ?? "", "pt-BR"),
  );

  const pendentes = lote.filter((l) => l.situacao === "pendente");
  const travadas = pendentes.filter((l) => l.bloqueios.length > 0);
  const aEmitir = pendentes.filter((l) => l.bloqueios.length === 0);
  const emitidas = lote.filter((l) => l.situacao === "emitida");
  const comAviso = aEmitir.filter((l) => l.avisos.length > 0);
  const total = aEmitir.reduce((soma, l) => soma + l.valor, 0);
  const impostoDoLote = enquadramento ? total * enquadramento.aliquotaEfetiva : null;
  const producao = emProducao();

  const colunas: [string, string][] = [
    ["Cliente", "pl-5 pr-4"],
    ["Serviço na nota", "pr-4"],
    ["Valor", "pr-4 text-right"],
    ["Situação", "pr-4"],
    ["", "pr-5"],
  ];

  return (
    <div className="min-h-screen bg-bg">
      <div className={cn(CONTAINER, "flex flex-col gap-7 pb-44")}>
        <PageHeader
          eyebrow="Colombo Media · financeiro"
          title={`Notas de ${rotuloDaCompetencia(competencia)}`}
          actions={
            <form className="flex items-end gap-2">
              <Field id="competencia" name="competencia" as="select" label="Competência" defaultValue={competencia} className="min-w-[200px]">
                {opcoesDeCompetencia(competencia).map((mes) => (
                  <option key={mes} value={mes}>
                    {rotuloDaCompetencia(mes)}
                  </option>
                ))}
              </Field>
              <Button type="submit">Ver</Button>
            </form>
          }
        />

        <div className="flex flex-col gap-4">
          {/* Ambiente antes de tudo: a primeira coisa a saber é se vale de verdade. */}
          {producao ? (
            <Notice tone="warn" title="Ambiente de produção">
              O que for emitido aqui é nota fiscal de verdade. Sai das assinaturas ativas do Asaas e nada é
              emitido até você clicar.
            </Notice>
          ) : (
            <Notice tone="info" title="Ambiente de teste (sandbox)">
              Nada aqui tem valor fiscal. Sai das assinaturas ativas do Asaas e nada é emitido até você clicar.
            </Notice>
          )}

          {pendencias.length > 0 && (
            <Notice tone="warn" title="Falta configurar antes de emitir">
              <ul className="mt-1 list-disc space-y-1 pl-4">
                {pendencias.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </Notice>
          )}

          {falha && (
            <Notice tone="bad" title="Não deu pra ler o Asaas">
              <p className="break-all">{falha}</p>
            </Notice>
          )}
        </div>

        {lote.length > 0 && (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-12 gap-4">
              <Kpi label="A emitir" value={aEmitir.length} sub={`de ${lote.length} contratos`} className="col-span-12 md:col-span-4" />
              <Kpi label="Valor do lote" value={total} money sub={comAviso.length ? `${comAviso.length} com aviso` : "sem avisos"} className="col-span-12 md:col-span-4" />
              <Kpi
                label="Emitidas"
                value={emitidas.length}
                sub={emitidas.length ? "neste mês" : "nenhuma ainda"}
                tone={emitidas.length ? "good" : undefined}
                className="col-span-12 md:col-span-4"
              />
            </div>

            {enquadramento && (
              <p className="flex flex-wrap items-center gap-x-5 gap-y-1 px-1 type-caption tabular-nums text-dim">
                <span>
                  Anexo <span className="text-mute">{enquadramento.anexo}</span>, faixa{" "}
                  <span className="text-mute">{enquadramento.faixa}</span>
                </span>
                <span>
                  RBT12 <span className="text-mute">{real(enquadramento.rbt12)}</span>
                </span>
                <span>
                  efetiva <span className="text-mute">{(enquadramento.aliquotaEfetiva * 100).toFixed(2)}%</span>
                </span>
                {impostoDoLote !== null && (
                  <span>
                    imposto estimado <span className="text-warn">{real(impostoDoLote)}</span>
                  </span>
                )}
                {travadas.length > 0 && (
                  <span>
                    <span className="text-warn">{travadas.length}</span> travadas por cadastro
                  </span>
                )}
                {enquadramento.ateProximaFaixa !== null && (
                  <span>
                    faltam <span className="text-mute">{real(enquadramento.ateProximaFaixa)}</span> pra próxima
                    faixa
                  </span>
                )}
                <span>estimativa de rateio do DAS, não apuração</span>
              </p>
            )}
          </div>
        )}

        {!falha && !semChave && lote.length === 0 && (
          <Empty
            title="Nenhuma nota para esta competência"
            text="O Asaas não tem assinatura mensal ativa neste mês. Troque a competência no seletor acima."
          />
        )}

        {lote.length > 0 && (
          <Surface className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-separate border-spacing-0 tabular-nums">
              <thead>
                <tr className="text-left">
                  {colunas.map(([titulo, classe]) => (
                    <Label key={titulo || "acao"} as="th" className={cn("h-12 border-b border-line align-middle", classe)}>
                      {titulo}
                    </Label>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lote.map((linha) => (
                  <Linha key={linha.referencia} linha={linha} />
                ))}
              </tbody>
            </table>
          </Surface>
        )}
      </div>

      {/* Barra de ação fixa: com trinta e tantas linhas, rolar até o fim pra emitir é atrito. Fica acima da barra inferior do celular (§4.4). */}
      {aEmitir.length > 0 && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(56px+12px)] z-30 px-4 sm:bottom-6 sm:px-6 lg:px-10">
          <Surface className="pointer-events-auto mx-auto flex w-full max-w-[1280px] flex-wrap items-center justify-between gap-4 px-5 py-3 shadow-float">
            <p className="type-body text-mute">
              <span className="font-semibold tabular-nums text-fg">{aEmitir.length}</span> a emitir, somando{" "}
              <span className="font-semibold tabular-nums text-fg">{real(total)}</span>
              {comAviso.length > 0 && (
                <span className="text-warn">
                  {" · "}
                  <span className="font-semibold tabular-nums">{comAviso.length}</span> com aviso
                </span>
              )}
              {travadas.length > 0 && (
                <span className="text-bad">
                  {" · "}
                  <span className="font-semibold tabular-nums">{travadas.length}</span> travadas por cadastro
                </span>
              )}
            </p>

            {pendencias.length === 0 ? (
              <form action={emitirPendentes}>
                <input type="hidden" name="competencia" value={competencia} />
                <SubmitButton variant="primary" iconEnd={<Send aria-hidden strokeWidth={1.75} />}>
                  Emitir as {aEmitir.length} pendentes
                </SubmitButton>
              </form>
            ) : (
              <span className="type-caption text-dim">emissão travada até a configuração ficar completa</span>
            )}
          </Surface>
        </div>
      )}
    </div>
  );
}
