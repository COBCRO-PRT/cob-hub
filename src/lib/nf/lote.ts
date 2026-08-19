import { anexoSimples, descricaoPadrao } from "./config";
import { enquadrar, impostoDaNota, type Enquadramento } from "./simples";
import {
  agendarNota,
  autorizarNota,
  buscarCliente,
  listarAssinaturasAtivas,
  listarNotas,
  listarRecebidos,
  type Customer,
  type Impostos,
  type Invoice,
  type Subscription,
} from "./asaas";

/** Competência no formato AAAA-MM. É o mês de referência do serviço prestado. */
export type Competencia = string;

export type SituacaoLinha = "pendente" | "emitida" | "processando" | "cancelada" | "erro";

export type LinhaDoLote = {
  assinatura: Subscription;
  cliente: Customer;
  /** Chave determinística. É o que impede a mesma nota sair duas vezes. */
  referencia: string;
  valor: number;
  descricao: string;
  /** A nota no Asaas, quando já existe. Null quando ainda não foi emitida. */
  nota: Invoice | null;
  situacao: SituacaoLinha;
  /** O que conferir antes de emitir esta linha. Vazio quando está limpa. */
  avisos: string[];
  /** Rateio do DAS do mês nesta nota. Null quando o anexo não foi configurado. */
  imposto: number | null;
  /** Valor menos o imposto rateado. Null pelo mesmo motivo. */
  liquido: number | null;
};

export type Lote = {
  linhas: LinhaDoLote[];
  /** Null quando NF_ANEXO_SIMPLES não está definido: melhor sem número do que com número errado. */
  enquadramento: Enquadramento | null;
};

/**
 * Janela do RBT12: os 12 meses encerrados no mês anterior ao da competência.
 * É assim que o Simples calcula, e não pelos 12 meses corridos até hoje.
 */
export function janelaRbt12(competencia: Competencia): { inicio: string; fim: string } {
  const [ano, mes] = competencia.split("-").map(Number);
  const fim = new Date(ano, mes - 1, 0);
  const inicio = new Date(fim.getFullYear(), fim.getMonth() - 11, 1);
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { inicio: iso(inicio), fim: iso(fim) };
}

/** Exatamente 12, na ordem, porque o índice aqui é o número do mês menos um. */
const NOMES_DE_MES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** Grafias soltas que aparecem em descrição digitada à mão. Fora do array acima
 * de propósito: misturar variante com a lista indexada desalinha todos os meses. */
const VARIANTES: Record<string, string> = { marco: "março", setembro: "setembro" };

function mesCitadoEm(texto: string): string | undefined {
  for (const termo of [...NOMES_DE_MES, "marco"]) {
    if (new RegExp(`\\b${termo}\\b`, "i").test(texto)) return VARIANTES[termo] ?? termo;
  }
  return undefined;
}

/**
 * Decide o texto do serviço e o que avisar sobre ele.
 *
 * A descrição vai impressa na nota fiscal, então uma assinatura criada em junho
 * com "Mensalidade - Junho" no nome não pode virar a nota de agosto no piloto
 * automático.
 */
function descreverServico(
  bruta: string | null,
  competencia: Competencia,
): { descricao: string; avisos: string[] } {
  const texto = (bruta ?? "").trim();
  const avisos: string[] = [];

  if (!texto) {
    return { descricao: descricaoPadrao(), avisos: ["Assinatura sem descrição, usando o texto padrão"] };
  }

  const mesDaCompetencia = NOMES_DE_MES[Number(competencia.split("-")[1]) - 1];
  const mesCitado = mesCitadoEm(texto);

  if (mesCitado && mesCitado !== mesDaCompetencia) {
    avisos.push(`Descrição cita "${mesCitado}" mas a competência é ${mesDaCompetencia}`);
  }

  return { descricao: texto, avisos };
}

/**
 * Referência determinística da nota: cob-202608-sub_000123.
 *
 * Vai no campo externalReference do Asaas e é o coração da idempotência. Se a
 * referência já existe no mês, a linha aparece como emitida e o botão some,
 * então clicar duas vezes não gera nota duplicada.
 */
export function referenciaDaNota(assinaturaId: string, competencia: Competencia): string {
  return `cob-${competencia.replace("-", "")}-${assinaturaId}`;
}

export function competenciaAtual(hoje = new Date()): Competencia {
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
}

/** Primeiro e último dia da competência, em AAAA-MM-DD, pra filtrar notas do mês. */
export function limitesDaCompetencia(competencia: Competencia): { inicio: string; fim: string } {
  const [ano, mes] = competencia.split("-").map(Number);
  const ultimoDia = new Date(ano, mes, 0).getDate();
  return {
    inicio: `${competencia}-01`,
    fim: `${competencia}-${String(ultimoDia).padStart(2, "0")}`,
  };
}

export function rotuloDaCompetencia(competencia: Competencia): string {
  const [ano, mes] = competencia.split("-").map(Number);
  const nomes = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
  ];
  return `${nomes[mes - 1]} de ${ano}`;
}

function situacaoDe(nota: Invoice | null): SituacaoLinha {
  if (!nota) return "pendente";

  switch (nota.status) {
    case "AUTHORIZED":
      return "emitida";
    case "SCHEDULED":
      return "processando";
    case "CANCELED":
      return "cancelada";
    case "PROCESSING_CANCELLATION":
      return "processando";
    default:
      return "erro";
  }
}

/**
 * Monta o lote do mês cruzando as assinaturas ativas com as notas já existentes.
 *
 * Nada é criado no Asaas aqui: esta função só lê. A nota fiscal só nasce quando
 * alguém aprova na tela, que é a trava que o processo manual não tinha.
 */
export async function montarLote(competencia: Competencia): Promise<Lote> {
  const { inicio, fim } = limitesDaCompetencia(competencia);

  const anexo = anexoSimples();
  const janela = janelaRbt12(competencia);

  // O RBT12 só é buscado quando há anexo definido: são várias páginas de
  // cobranças e não faz sentido pagar esse custo pra não mostrar nada.
  const [assinaturas, notasDoMes, recebidos] = await Promise.all([
    listarAssinaturasAtivas(),
    listarNotas({ "effectiveDate[ge]": inicio, "effectiveDate[le]": fim }),
    anexo ? listarRecebidos(janela.inicio, janela.fim) : Promise.resolve([]),
  ]);

  const enquadramento = anexo
    ? enquadrar(
        recebidos.reduce((soma, p) => soma + (p.value ?? 0), 0),
        anexo,
      )
    : null;

  // Só mensalidade entra no lote mensal. Anual ou semanal seguem outra régua.
  const mensais = assinaturas.filter((a) => a.cycle === "MONTHLY");

  const porReferencia = new Map(
    notasDoMes.filter((n) => n.externalReference).map((n) => [n.externalReference as string, n]),
  );

  // Uma chamada por cliente, em paralelo. São poucas dezenas, cabe tranquilo.
  const clientes = new Map<string, Customer>();
  await Promise.all(
    [...new Set(mensais.map((a) => a.customer))].map(async (id) => {
      clientes.set(id, await buscarCliente(id));
    }),
  );

  // Mesmo cliente com mais de uma assinatura gera mais de uma nota, o que o
  // layout nacional exige (uma nota por serviço). Avisar evita susto.
  const assinaturasPorCliente = new Map<string, number>();
  for (const a of mensais) {
    assinaturasPorCliente.set(a.customer, (assinaturasPorCliente.get(a.customer) ?? 0) + 1);
  }

  const linhas = mensais.map((assinatura) => {
    const referencia = referenciaDaNota(assinatura.id, competencia);
    const nota = porReferencia.get(referencia) ?? null;
    const { descricao, avisos } = descreverServico(assinatura.description, competencia);

    const quantas = assinaturasPorCliente.get(assinatura.customer) ?? 1;
    if (quantas > 1) avisos.push(`Este cliente tem ${quantas} assinaturas, então recebe ${quantas} notas`);

    return {
      assinatura,
      cliente: clientes.get(assinatura.customer) as Customer,
      referencia,
      valor: assinatura.value,
      descricao,
      nota,
      situacao: situacaoDe(nota),
      avisos,
      imposto: enquadramento ? impostoDaNota(assinatura.value, enquadramento) : null,
      liquido: enquadramento
        ? assinatura.value - impostoDaNota(assinatura.value, enquadramento)
        : null,
    };
  });

  return { linhas, enquadramento };
}

export type DadosDaEmissao = {
  referencia: string;
  valor: number;
  descricao: string;
  clienteId: string;
  municipalServiceId?: string;
  municipalServiceCode?: string;
  municipalServiceName?: string;
  impostos: Impostos;
  observacoes: string;
};

/**
 * Emite uma nota do lote.
 *
 * Cria com effectiveDate de hoje e, se o Asaas devolver SCHEDULED, chama
 * authorize pra sair na hora em vez de esperar a rotina do dia.
 */
export async function emitirNota(dados: DadosDaEmissao): Promise<Invoice> {
  const hoje = new Date().toISOString().slice(0, 10);

  const nota = await agendarNota({
    customer: dados.clienteId,
    serviceDescription: dados.descricao,
    observations: dados.observacoes,
    externalReference: dados.referencia,
    value: dados.valor,
    deductions: 0,
    effectiveDate: hoje,
    municipalServiceId: dados.municipalServiceId,
    municipalServiceCode: dados.municipalServiceCode,
    municipalServiceName: dados.municipalServiceName,
    taxes: dados.impostos,
  });

  return nota.status === "SCHEDULED" ? autorizarNota(nota.id) : nota;
}
