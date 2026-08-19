import { emProducao, pendenciasDaConfiguracao } from "@/lib/nf/config";
import {
  competenciaAtual,
  montarLote,
  rotuloDaCompetencia,
  type Competencia,
  type LinhaDoLote,
  type SituacaoLinha,
} from "@/lib/nf/lote";
import { cancelarLinha, emitirLinha, emitirPendentes } from "./acoes";

export const metadata = {
  title: "Notas do mês — COB Hub",
  robots: { index: false, follow: false },
};

// Nota fiscal não pode vir de cache: o que está emitido muda a cada clique.
export const dynamic = "force-dynamic";

const real = (valor: number) =>
  valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const SELO: Record<SituacaoLinha, { texto: string; classe: string }> = {
  pendente: { texto: "a emitir", classe: "bg-white/5 text-zinc-300 border-white/10" },
  emitida: { texto: "emitida", classe: "bg-[#c0de1b]/10 text-[#c0de1b] border-[#c0de1b]/20" },
  processando: { texto: "processando", classe: "bg-amber-400/10 text-amber-300 border-amber-400/20" },
  cancelada: { texto: "cancelada", classe: "bg-white/5 text-zinc-500 border-white/10" },
  erro: { texto: "erro", classe: "bg-red-500/10 text-red-400 border-red-500/20" },
};

function Linha({ linha }: { linha: LinhaDoLote }) {
  const selo = SELO[linha.situacao];
  // O id liga os campos espalhados pela linha ao mesmo form, já que <tr> não
  // pode ser embrulhado por <form> em HTML válido.
  const formId = `emitir-${linha.referencia}`;

  return (
    <tr className="border-b border-white/5 last:border-0">
      <td className="py-4 pr-4 align-top">
        <div className="text-[15px] font-medium text-white">
          {linha.cliente?.name ?? linha.assinatura.customer}
        </div>
        <div className="mt-0.5 font-mono text-[11px] text-zinc-600">{linha.referencia}</div>
        {linha.avisos.map((aviso) => (
          <div key={aviso} className="mt-1.5 text-[11.5px] leading-snug text-amber-400/80">
            {aviso}
          </div>
        ))}
      </td>

      <td className="py-4 pr-4 align-top">
        {linha.situacao === "pendente" ? (
          <input
            type="text"
            name="descricao"
            form={formId}
            defaultValue={linha.descricao}
            aria-label={`Descrição do serviço de ${linha.cliente?.name ?? "cliente"}`}
            className="w-full min-w-[240px] rounded-lg border border-white/10 bg-[#141414] px-2 py-1.5 text-[13px] text-white outline-none focus:border-[#c0de1b]"
          />
        ) : (
          <span className="text-[14px] leading-relaxed text-zinc-400">{linha.descricao}</span>
        )}
      </td>

      <td className="py-4 pr-4 align-top text-right whitespace-nowrap">
        {linha.situacao === "pendente" ? (
          <input
            type="number"
            name="valor"
            form={formId}
            step="0.01"
            min="0.01"
            defaultValue={linha.valor}
            aria-label={`Valor da nota de ${linha.cliente?.name ?? "cliente"}`}
            className="w-28 rounded-lg border border-white/10 bg-[#141414] px-2 py-1.5 text-right font-mono text-[13px] text-white outline-none focus:border-[#c0de1b]"
          />
        ) : (
          <span className="font-mono text-[14px] text-white">{real(linha.valor)}</span>
        )}
      </td>

      <td className="py-4 pr-4 align-top">
        <span className={`inline-block rounded-md border px-2 py-1 text-[11px] font-medium ${selo.classe}`}>
          {selo.texto}
        </span>
        {linha.nota?.number && (
          <div className="mt-1 font-mono text-[11px] text-zinc-600">nº {linha.nota.number}</div>
        )}
      </td>

      <td className="py-4 align-top text-right whitespace-nowrap">
        {linha.situacao === "pendente" && (
          <form action={emitirLinha} id={formId}>
            <input type="hidden" name="clienteId" value={linha.cliente?.id ?? ""} />
            <input type="hidden" name="referencia" value={linha.referencia} />
            <button
              type="submit"
              className="rounded-lg bg-[#c0de1b] px-3 py-1.5 text-[13px] font-semibold text-[#0a0a0a] transition hover:brightness-110"
            >
              Emitir
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
                className="text-[13px] text-zinc-400 underline underline-offset-4 hover:text-white"
              >
                PDF
              </a>
            )}
            <form action={cancelarLinha}>
              <input type="hidden" name="notaId" value={linha.nota.id} />
              <button
                type="submit"
                className="text-[13px] text-zinc-500 underline underline-offset-4 transition hover:text-red-400"
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

  let lote: LinhaDoLote[] = [];
  let falha: string | null = null;

  // Sem chave não adianta bater no Asaas: a pendência já explica o que falta,
  // e um erro de conexão por cima só repetiria a mesma informação.
  const semChave = !process.env.ASAAS_API_KEY;

  if (!semChave) {
    try {
      lote = await montarLote(competencia);
    } catch (erro) {
      falha = erro instanceof Error ? erro.message : String(erro);
    }
  }

  const aEmitir = lote.filter((l) => l.situacao === "pendente");
  const total = aEmitir.reduce((soma, l) => soma + l.valor, 0);

  return (
    <div className="min-h-screen bg-[#0a0a0a] px-6 py-10">
      <div className="mx-auto w-full max-w-[1080px]">
        <a href="/" className="text-[13px] text-zinc-500 underline underline-offset-4 hover:text-white">
          voltar ao menu
        </a>

        <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[28px] font-bold leading-tight tracking-tight text-white">
              Notas de {rotuloDaCompetencia(competencia)}
            </h1>
            <p className="mt-2 text-[14.5px] leading-relaxed text-zinc-400">
              Sai das assinaturas ativas do Asaas. Nada é emitido até você clicar.
            </p>
          </div>

          <form className="flex items-center gap-2">
            <input
              type="month"
              name="competencia"
              defaultValue={competencia}
              aria-label="Competência"
              className="rounded-lg border border-white/10 bg-[#141414] px-3 py-2 text-[13px] text-white outline-none focus:border-[#c0de1b]"
            />
            <button
              type="submit"
              className="rounded-lg border border-white/10 px-3 py-2 text-[13px] text-zinc-300 transition hover:border-[#c0de1b] hover:text-white"
            >
              Ver
            </button>
          </form>
        </div>

        {emProducao() ? (
          <p className="mt-6 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 font-mono text-[12px] text-red-400">
            Ambiente de produção. O que for emitido aqui é nota fiscal de verdade.
          </p>
        ) : (
          <p className="mt-6 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 font-mono text-[12px] text-zinc-400">
            Ambiente de teste (sandbox). Nada aqui tem valor fiscal.
          </p>
        )}

        {pendencias.length > 0 && (
          <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-3">
            <p className="text-[13px] font-medium text-amber-300">Falta configurar antes de emitir:</p>
            <ul className="mt-2 space-y-1">
              {pendencias.map((item) => (
                <li key={item} className="font-mono text-[12px] leading-relaxed text-amber-400/80">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        {falha && (
          <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
            <p className="text-[13px] font-medium text-red-400">Não deu pra ler o Asaas:</p>
            <p className="mt-2 font-mono text-[12px] leading-relaxed break-all text-red-400/80">{falha}</p>
          </div>
        )}

        {!falha && !semChave && lote.length === 0 && (
          <p className="mt-10 text-[14.5px] text-zinc-500">
            Nenhuma assinatura mensal ativa no Asaas para esta competência.
          </p>
        )}

        {lote.length > 0 && (
          <>
            <div className="mt-8 overflow-x-auto rounded-2xl border border-white/10 bg-[#0f0f0f] px-5">
              <table className="w-full min-w-[760px] border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-left">
                    <th className="py-3 pr-4 text-[12px] font-medium text-zinc-500">Cliente</th>
                    <th className="py-3 pr-4 text-[12px] font-medium text-zinc-500">Serviço</th>
                    <th className="py-3 pr-4 text-right text-[12px] font-medium text-zinc-500">Valor</th>
                    <th className="py-3 pr-4 text-[12px] font-medium text-zinc-500">Situação</th>
                    <th className="py-3 text-right text-[12px] font-medium text-zinc-500">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {lote.map((linha) => (
                    <Linha key={linha.referencia} linha={linha} />
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
              <p className="text-[14px] text-zinc-400">
                {aEmitir.length === 0 ? (
                  "Tudo desta competência já foi emitido."
                ) : (
                  <>
                    <span className="text-white">{aEmitir.length}</span> a emitir, somando{" "}
                    <span className="font-mono text-white">{real(total)}</span>
                  </>
                )}
              </p>

              {aEmitir.length > 0 && pendencias.length === 0 && (
                <form action={emitirPendentes}>
                  <input type="hidden" name="competencia" value={competencia} />
                  <button
                    type="submit"
                    className="rounded-xl bg-[#c0de1b] px-5 py-3 text-[14px] font-semibold text-[#0a0a0a] transition hover:brightness-110"
                  >
                    Emitir as {aEmitir.length} pendentes
                  </button>
                </form>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
