/**
 * Cálculo do Simples Nacional.
 *
 * No Simples não existe imposto "da nota": paga-se um DAS mensal sobre a receita
 * do mês, com alíquota que depende do faturamento dos últimos 12 meses. O que
 * este módulo faz é ratear esse custo por nota, para dar noção de líquido.
 * É estimativa de gestão, não apuração fiscal.
 *
 * Tabelas conferidas para 2026. A LC 214/2025 (reforma tributária) não alterou
 * as faixas nem as parcelas a deduzir dos anexos.
 */

export type Anexo = "III" | "V";

type Faixa = {
  /** Teto de receita bruta em 12 meses da faixa. */
  teto: number;
  /** Alíquota nominal da tabela, que não é a que se paga. */
  nominal: number;
  /** Parcela a deduzir, o que faz a alíquota efetiva ser menor que a nominal. */
  deduzir: number;
};

/** Serviços com Fator R igual ou acima de 28%. */
const ANEXO_III: Faixa[] = [
  { teto: 180_000, nominal: 0.06, deduzir: 0 },
  { teto: 360_000, nominal: 0.112, deduzir: 9_360 },
  { teto: 720_000, nominal: 0.135, deduzir: 17_640 },
  { teto: 1_800_000, nominal: 0.16, deduzir: 35_640 },
  { teto: 3_600_000, nominal: 0.21, deduzir: 125_640 },
  { teto: 4_800_000, nominal: 0.33, deduzir: 648_000 },
];

/** Serviços com Fator R abaixo de 28%. Publicidade cai aqui por padrão. */
const ANEXO_V: Faixa[] = [
  { teto: 180_000, nominal: 0.155, deduzir: 0 },
  { teto: 360_000, nominal: 0.18, deduzir: 4_500 },
  { teto: 720_000, nominal: 0.195, deduzir: 9_900 },
  { teto: 1_800_000, nominal: 0.205, deduzir: 17_100 },
  { teto: 3_600_000, nominal: 0.23, deduzir: 62_100 },
  { teto: 4_800_000, nominal: 0.305, deduzir: 540_000 },
];

const TABELAS: Record<Anexo, Faixa[]> = { III: ANEXO_III, V: ANEXO_V };

/** Teto de receita do Simples. Passar disso desenquadra a empresa. */
export const TETO_DO_SIMPLES = 4_800_000;

/** Fator R que joga a empresa do Anexo V para o III. */
export const FATOR_R_MINIMO = 0.28;

export type Enquadramento = {
  anexo: Anexo;
  rbt12: number;
  /** 1 a 6. Serve pra avisar quando a próxima faixa está perto. */
  faixa: number;
  aliquotaEfetiva: number;
  /** Quanto ainda cabe antes de pular de faixa. Null na última. */
  ateProximaFaixa: number | null;
};

export function enquadrar(rbt12: number, anexo: Anexo): Enquadramento {
  const tabela = TABELAS[anexo];

  // Empresa sem histórico entra pela primeira faixa, sem parcela a deduzir.
  if (rbt12 <= 0) {
    return { anexo, rbt12: 0, faixa: 1, aliquotaEfetiva: tabela[0].nominal, ateProximaFaixa: tabela[0].teto };
  }

  const indice = Math.max(0, tabela.findIndex((f) => rbt12 <= f.teto));
  const faixa = tabela[indice] ?? tabela[tabela.length - 1];

  return {
    anexo,
    rbt12,
    faixa: indice + 1,
    // A fórmula oficial: o que faz a alíquota crescer de forma contínua em vez
    // de dar um salto ao trocar de faixa.
    aliquotaEfetiva: (rbt12 * faixa.nominal - faixa.deduzir) / rbt12,
    ateProximaFaixa: indice < tabela.length - 1 ? faixa.teto - rbt12 : null,
  };
}

/** Quanto uma nota deste valor custa de imposto, rateando o DAS do mês. */
export function impostoDaNota(valor: number, enquadramento: Enquadramento): number {
  return valor * enquadramento.aliquotaEfetiva;
}

/** Folha de 12 meses necessária para o Fator R levar do Anexo V ao III. */
export function folhaParaFatorR(rbt12: number): number {
  return rbt12 * FATOR_R_MINIMO;
}
