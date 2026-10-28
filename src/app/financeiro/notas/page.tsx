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
import { cancelarLinha, emitirLinha, emitirPendentes } from "./acoes";

export const metadata = {
  title: "Notas do mês · COB Hub",
  robots: { index: false, follow: false },
};

// Nota fiscal não pode vir de cache: o que está emitido muda a cada clique.
export const dynamic = "force-dynamic";

const real = (valor: number) =>
  valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const numero = (valor: number) =>
  valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const SELO: Record<SituacaoLinha, { texto: string; classe: string }> = {
  pendente: { texto: "a emitir", classe: "border-white/12 bg-white/5 text-zinc-400" },
  emitida: { texto: "emitida", classe: "border-[#00e5ff]/25 bg-[#00e5ff]/10 text-[#00e5ff]" },
  processando: { texto: "na fila", classe: "border-amber-400/25 bg-amber-400/10 text-amber-300" },
  cancelada: { texto: "cancelada", classe: "border-white/8 bg-transparent text-zinc-600" },
  erro: { texto: "erro", classe: "border-red-500/30 bg-red-500/10 text-red-400" },
};

/** Número grande com rótulo miúdo. É o que se lê de longe antes de decidir. */
function Metrica({
  rotulo,
  valor,
  detalhe,
  tom = "neutro",
}: {
  rotulo: string;
  valor: string;
  detalhe?: string;
  tom?: "neutro" | "acento" | "atencao";
}) {
  const cor =
    tom === "acento" ? "text-[#00e5ff]" : tom === "atencao" ? "text-amber-300" : "text-white";

  return (
    <div className="flex-1 border-l border-white/8 px-5 py-4 first:border-l-0 first:pl-0">
      <div className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-zinc-600">
        {rotulo}
      </div>
      <div className={`mt-2 font-mono text-[26px] leading-none tabular-nums ${cor}`}>{valor}</div>
      {detalhe && <div className="mt-1.5 text-[12px] text-zinc-600">{detalhe}</div>}
    </div>
  );
}

function Linha({ linha }: { linha: LinhaDoLote }) {
  const selo = SELO[linha.situacao];
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
    <tr className="group transition-colors hover:bg-white/[0.02] [&>td]:border-b [&>td]:border-white/[0.06] last:[&>td]:border-b-0">
      <td className="py-3.5 pl-5 pr-4 align-top">
        <div className="text-[14.5px] font-medium leading-snug text-white">
          {linha.cliente?.name ?? linha.assinatura.customer}
        </div>
        <div className="mt-1 font-mono text-[10.5px] tracking-tight text-zinc-700">
          {linha.referencia}
        </div>
        {linha.bloqueios.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {linha.bloqueios.map((bloqueio) => (
              <span
                key={bloqueio}
                className="rounded border border-red-500/25 bg-red-500/[0.08] px-1.5 py-0.5 text-[11px] leading-snug text-red-400/90"
              >
                {bloqueio}
              </span>
            ))}
          </div>
        )}

        {linha.situacao === "erro" && linha.nota?.statusDescription && (
          <div className="mt-2 rounded border border-red-500/25 bg-red-500/[0.08] px-2 py-1.5 text-[11px] leading-snug text-red-300/90">
            <span className="font-medium text-red-300">Recusada pela prefeitura: </span>
            {linha.nota.statusDescription}
          </div>
        )}
        {linha.avisos.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {linha.avisos.map((aviso) => (
              <span
                key={aviso}
                className="rounded border border-amber-400/20 bg-amber-400/[0.07] px-1.5 py-0.5 text-[11px] leading-snug text-amber-300/90"
              >
                {aviso}
              </span>
            ))}
          </div>
        )}
      </td>

      <td className="py-3.5 pr-4 align-top">
        {podeEmitir ? (
          <input
            type="text"
            name="descricao"
            form={formId}
            defaultValue={linha.descricao}
            aria-label={`Descrição do serviço de ${linha.cliente?.name ?? "cliente"}`}
            className="w-full min-w-[220px] rounded-md border border-transparent bg-white/[0.04] px-2.5 py-1.5 text-[13px] text-zinc-200 outline-none transition-colors hover:bg-white/[0.06] focus:border-[#00e5ff]/60 focus:bg-[#00e5ff]/[0.04]"
          />
        ) : (
          <span className="text-[13px] leading-relaxed text-zinc-500">{linha.descricao}</span>
        )}
      </td>

      <td className="py-3.5 pr-4 align-top">
        {podeEmitir ? (
          <div className="flex items-center justify-end gap-1.5 rounded-md border border-transparent bg-white/[0.04] px-2.5 py-1.5 transition-colors focus-within:border-[#00e5ff]/60 focus-within:bg-[#00e5ff]/[0.04] hover:bg-white/[0.06]">
            <span className="font-mono text-[11px] text-zinc-600">R$</span>
            <input
              type="number"
              name="valor"
              form={formId}
              step="0.01"
              min="0.01"
              defaultValue={linha.valor}
              aria-label={`Valor da nota de ${linha.cliente?.name ?? "cliente"}`}
              className="w-[86px] bg-transparent text-right font-mono text-[13px] tabular-nums text-white outline-none"
            />
          </div>
        ) : (
          <div className="pr-2.5 text-right font-mono text-[13px] tabular-nums text-zinc-400">
            {numero(linha.valor)}
          </div>
        )}

        {linha.imposto !== null && linha.liquido !== null && (
          <div className="mt-1.5 pr-2.5 text-right font-mono text-[10.5px] leading-relaxed tabular-nums text-zinc-600">
            <span className="text-amber-400/60">−{numero(linha.imposto)}</span>
            {" imposto"}
            <br />
            <span className="text-zinc-400">{numero(linha.liquido)}</span>
            {" líquido"}
          </div>
        )}
      </td>

      <td className="py-3.5 pr-4 align-top">
        <span
          className={`inline-block whitespace-nowrap rounded border px-2 py-[3px] text-[11px] font-medium ${selo.classe}`}
        >
          {selo.texto}
        </span>
        {linha.nota?.number && (
          <div className="mt-1.5 font-mono text-[10.5px] text-zinc-600">nº {linha.nota.number}</div>
        )}
      </td>

      <td className="py-3.5 pr-5 align-top text-right">
        {podeEmitir && travada && (
          <span className="font-mono text-[11px] text-red-400/70">cadastro incompleto</span>
        )}

        {podeEmitir && !travada && (
          <form action={emitirLinha} id={formId}>
            <input type="hidden" name="clienteId" value={linha.cliente?.id ?? ""} />
            <input type="hidden" name="referencia" value={linha.referencia} />
            <button
              type="submit"
              className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12.5px] font-medium text-zinc-300 transition-all hover:border-[#00e5ff]/50 hover:bg-[#00e5ff]/10 hover:text-[#00e5ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00e5ff]"
            >
              {reemissao ? "Emitir de novo" : "Emitir"}
            </button>
          </form>
        )}

        {linha.nota && linha.situacao !== "cancelada" && (
          <div className="flex items-center justify-end gap-3">
            {linha.nota.pdfUrl && (
              <a
                href={linha.nota.pdfUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[12.5px] text-zinc-400 underline decoration-white/20 underline-offset-4 transition-colors hover:text-white hover:decoration-white/60"
              >
                PDF
              </a>
            )}
            <form action={cancelarLinha}>
              <input type="hidden" name="notaId" value={linha.nota.id} />
              <button
                type="submit"
                className="text-[12.5px] text-zinc-600 underline decoration-transparent underline-offset-4 transition-colors hover:text-red-400 hover:decoration-red-400/40"
              >
                Cancelar
              </button>
            </form>
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

  return (
    <div className="min-h-screen bg-[#07080a]">
      {/* Faixa de ambiente colada no topo: a primeira coisa que se vê é se vale de verdade. */}
      <div
        className={`border-b px-6 py-2 text-center font-mono text-[11px] tracking-wide ${
          producao
            ? "border-red-500/20 bg-red-500/[0.07] text-red-400"
            : "border-white/8 bg-white/[0.02] text-zinc-500"
        }`}
      >
        {producao
          ? "AMBIENTE DE PRODUÇÃO: o que for emitido aqui é nota fiscal de verdade"
          : "ambiente de teste (sandbox): nada aqui tem valor fiscal"}
      </div>

      <div className="mx-auto w-full max-w-[1180px] px-6 pb-44 pt-8">
        <header className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <h1 className="text-[30px] font-bold leading-none tracking-[-0.02em] text-white">
              Notas de {rotuloDaCompetencia(competencia)}
            </h1>
            <p className="mt-2.5 max-w-[46ch] text-[13.5px] leading-relaxed text-zinc-500">
              Sai das assinaturas ativas do Asaas. Nada é emitido até você clicar.
            </p>
          </div>

          <form className="flex items-end gap-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-zinc-600">
                Competência
              </span>
              <input
                type="month"
                name="competencia"
                defaultValue={competencia}
                className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 font-mono text-[13px] text-zinc-200 outline-none transition-colors hover:bg-white/[0.06] focus:border-[#00e5ff]/60"
              />
            </label>
            <button
              type="submit"
              className="rounded-full border border-white/10 px-3.5 py-2 text-[13px] text-zinc-400 transition-colors hover:border-white/25 hover:text-white"
            >
              Ver
            </button>
          </form>
        </header>

        {lote.length > 0 && (
          <div className="mt-8 flex flex-wrap rounded-xl border border-white/8 bg-white/[0.015] px-5">
            <Metrica rotulo="A emitir" valor={String(aEmitir.length)} detalhe={`de ${lote.length} contratos`} />
            <Metrica rotulo="Somam" valor={`R$ ${numero(total)}`} tom="acento" />
            <Metrica
              rotulo="Já emitidas"
              valor={String(emitidas.length)}
              detalhe={emitidas.length ? "neste mês" : "nenhuma ainda"}
            />
            <Metrica
              rotulo="Travadas"
              valor={String(travadas.length)}
              detalhe={travadas.length ? "cadastro incompleto" : "nenhuma"}
              tom={travadas.length ? "atencao" : "neutro"}
            />
            {impostoDoLote !== null && enquadramento && (
              <Metrica
                rotulo="Imposto estimado"
                valor={`R$ ${numero(impostoDoLote)}`}
                detalhe={`${(enquadramento.aliquotaEfetiva * 100).toFixed(2)}% efetivo`}
                tom="atencao"
              />
            )}
          </div>
        )}

        {enquadramento && (
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 rounded-lg border border-white/8 bg-white/[0.015] px-4 py-2.5 font-mono text-[11.5px] text-zinc-600">
            <span>
              Anexo <span className="text-zinc-300">{enquadramento.anexo}</span>, faixa{" "}
              <span className="text-zinc-300">{enquadramento.faixa}</span>
            </span>
            <span>
              RBT12 <span className="text-zinc-300">R$ {numero(enquadramento.rbt12)}</span>
            </span>
            <span>
              efetiva{" "}
              <span className="text-zinc-300">
                {(enquadramento.aliquotaEfetiva * 100).toFixed(2)}%
              </span>
            </span>
            {enquadramento.ateProximaFaixa !== null && (
              <span>
                faltam{" "}
                <span className="text-zinc-300">R$ {numero(enquadramento.ateProximaFaixa)}</span>{" "}
                pra próxima faixa
              </span>
            )}
            <span className="text-zinc-700">estimativa de rateio do DAS, não apuração</span>
          </div>
        )}

        {pendencias.length > 0 && (
          <div className="mt-5 rounded-xl border border-amber-400/20 bg-amber-400/[0.05] px-5 py-4">
            <p className="text-[13px] font-medium text-amber-300">Falta configurar antes de emitir</p>
            <ul className="mt-2.5 space-y-1.5">
              {pendencias.map((item) => (
                <li key={item} className="font-mono text-[12px] leading-relaxed text-amber-400/75">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        {falha && (
          <div className="mt-5 rounded-xl border border-red-500/25 bg-red-500/[0.06] px-5 py-4">
            <p className="text-[13px] font-medium text-red-400">Não deu pra ler o Asaas</p>
            <p className="mt-2 break-all font-mono text-[12px] leading-relaxed text-red-400/75">
              {falha}
            </p>
          </div>
        )}

        {!falha && !semChave && lote.length === 0 && (
          <p className="mt-12 text-[14px] text-zinc-600">
            Nenhuma assinatura mensal ativa no Asaas para esta competência.
          </p>
        )}

        {lote.length > 0 && (
          <div className="mt-6 rounded-xl border border-white/8 bg-[#0d0d0d]">
            <div className="overflow-x-auto lg:overflow-x-visible">
              <table className="w-full min-w-[820px] border-separate border-spacing-0">
                <thead>
                  <tr className="text-left">
                    {[
                      ["Cliente", "pl-5 pr-4"],
                      ["Serviço na nota", "pr-4"],
                      ["Valor", "pr-4 text-right"],
                      ["Situação", "pr-4"],
                      ["", "pr-5"],
                    ].map(([titulo, classe]) => (
                      <th
                        key={titulo || "acao"}
                        className={`sticky top-0 z-10 border-b border-white/8 bg-[#0d0d0d] py-3 text-[10.5px] font-medium uppercase tracking-[0.14em] text-zinc-600 ${classe}`}
                      >
                        {titulo}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lote.map((linha) => (
                    <Linha key={linha.referencia} linha={linha} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Barra de ação fixa: com trinta e tantas linhas, rolar até o fim pra emitir é atrito. */}
      {aEmitir.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 border-t border-white/10 bg-[#07080a]/95 backdrop-blur">
          <div className="mx-auto flex w-full max-w-[1180px] flex-wrap items-center justify-between gap-4 px-6 py-4">
            <p className="text-[13.5px] text-zinc-500">
              <span className="font-mono tabular-nums text-white">{aEmitir.length}</span> a emitir,
              somando <span className="font-mono tabular-nums text-white">R$ {numero(total)}</span>
              {comAviso.length > 0 && (
                <span className="text-amber-400/80">
                  {" · "}
                  <span className="font-mono tabular-nums">{comAviso.length}</span> com aviso
                </span>
              )}
              {travadas.length > 0 && (
                <span className="text-red-400/80">
                  {" · "}
                  <span className="font-mono tabular-nums">{travadas.length}</span> travadas por
                  cadastro
                </span>
              )}
            </p>

            {pendencias.length === 0 ? (
              <form action={emitirPendentes}>
                <input type="hidden" name="competencia" value={competencia} />
                <button
                  type="submit"
                  className="rounded-full bg-[#00e5ff] px-5 py-2.5 text-[13.5px] font-semibold text-[#04141a] transition-all hover:bg-[#00b4d8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00e5ff]"
                >
                  Emitir as {aEmitir.length} pendentes
                </button>
              </form>
            ) : (
              <span className="font-mono text-[12px] text-zinc-600">
                emissão travada até a configuração ficar completa
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
