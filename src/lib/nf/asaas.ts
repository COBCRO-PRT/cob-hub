/**
 * Cliente da API do Asaas.
 *
 * A chave dá acesso total à conta, inclusive movimentação de dinheiro, então
 * este módulo só pode ser importado de Server Component ou Server Action.
 * O throw abaixo é a rede de segurança pra isso nunca vazar pro bundle do browser.
 */
if (typeof window !== "undefined") {
  throw new Error("src/lib/nf/asaas.ts é só de servidor. Não importe em client component.");
}

const BASES = {
  producao: "https://api.asaas.com/v3",
  sandbox: "https://api-sandbox.asaas.com/v3",
} as const;

export type Ambiente = keyof typeof BASES;

/** Ciclo de cobrança da assinatura. Só MONTHLY interessa pro lote mensal. */
export type Ciclo = "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "BIMONTHLY" | "QUARTERLY" | "SEMIANNUALLY" | "YEARLY";

export type Subscription = {
  id: string;
  customer: string;
  value: number;
  nextDueDate: string;
  cycle: Ciclo;
  status: "ACTIVE" | "EXPIRED" | "INACTIVE";
  description: string | null;
  billingType: string;
  dateCreated: string;
};

export type Customer = {
  id: string;
  name: string;
  cpfCnpj: string | null;
  email: string | null;
  city: number | null;
  cityName: string | null;
  state: string | null;
};

/** Status da nota no Asaas. SCHEDULED é o que a tela de aprovação segura. */
export type StatusNota =
  | "SCHEDULED"
  | "AUTHORIZED"
  | "PROCESSING_CANCELLATION"
  | "CANCELED"
  | "CANCELLATION_DENIED"
  | "ERROR";

export type Invoice = {
  id: string;
  status: StatusNota;
  customer: string;
  payment: string | null;
  number: string | null;
  pdfUrl: string | null;
  xmlUrl: string | null;
  value: number;
  effectiveDate: string;
  serviceDescription: string;
  validationCode: string | null;
  externalReference: string | null;
  municipalServiceId: string | null;
  municipalServiceName: string | null;
  taxes: Impostos;
  observations: string | null;
};

/**
 * Impostos da nota. Publicidade sofre retenção de IR e, acima do piso mensal,
 * de CSLL/PIS/COFINS. Quem define os percentuais é o contador, não este código.
 */
export type Impostos = {
  retainIss: boolean;
  iss: number;
  cofins: number;
  csll: number;
  inss: number;
  ir: number;
  pis: number;
};

export type ServicoMunicipal = {
  id: string;
  description: string;
  issTax: number;
};

export type NotaAgendada = {
  customer?: string;
  payment?: string;
  installment?: string;
  serviceDescription: string;
  observations: string;
  externalReference: string;
  value: number;
  deductions: number;
  effectiveDate: string;
  municipalServiceId?: string;
  municipalServiceCode?: string;
  municipalServiceName?: string;
  taxes: Impostos;
};

type Pagina<T> = { data: T[]; hasMore: boolean; totalCount: number };

function ambiente(): Ambiente {
  const valor = process.env.ASAAS_AMBIENTE;
  // Sandbox por padrão: errar pro lado que não emite nota fiscal de verdade.
  return valor === "producao" ? "producao" : "sandbox";
}

/** Erro com o corpo da resposta preservado, senão debugar emissão vira adivinhação. */
export class AsaasError extends Error {
  constructor(
    readonly status: number,
    readonly corpo: string,
    readonly rota: string,
  ) {
    super(`Asaas ${status} em ${rota}: ${corpo}`);
    this.name = "AsaasError";
  }
}

async function request<T>(rota: string, init?: RequestInit): Promise<T> {
  const chave = process.env.ASAAS_API_KEY;
  if (!chave) throw new Error("ASAAS_API_KEY não configurada. Sem ela nada consulta nem emite.");

  const resposta = await fetch(`${BASES[ambiente()]}${rota}`, {
    ...init,
    headers: {
      access_token: chave,
      "Content-Type": "application/json",
      // O Asaas pede identificação da aplicação nas chamadas.
      "User-Agent": "cob-hub",
      ...init?.headers,
    },
    // Dado fiscal e financeiro nunca vem de cache.
    cache: "no-store",
  });

  const texto = await resposta.text();
  if (!resposta.ok) throw new AsaasError(resposta.status, texto, rota);

  return texto ? (JSON.parse(texto) as T) : ({} as T);
}

/** Percorre a paginação até o fim. O limite do Asaas é 100 por página. */
async function listarTudo<T>(rota: string, params: Record<string, string> = {}): Promise<T[]> {
  const itens: T[] = [];
  let offset = 0;

  for (;;) {
    const query = new URLSearchParams({ ...params, limit: "100", offset: String(offset) });
    const pagina = await request<Pagina<T>>(`${rota}?${query}`);
    itens.push(...pagina.data);

    if (!pagina.hasMore) return itens;
    offset += 100;
  }
}

/** As assinaturas ativas são a fonte da verdade dos contratos. Nada é redigitado. */
export function listarAssinaturasAtivas(): Promise<Subscription[]> {
  return listarTudo<Subscription>("/subscriptions", { status: "ACTIVE" });
}

export function listarClientes(): Promise<Customer[]> {
  return listarTudo<Customer>("/customers");
}

export function buscarCliente(id: string): Promise<Customer> {
  return request<Customer>(`/customers/${id}`);
}

/**
 * Lista de serviços municipais da prefeitura. Vazia quando o município não
 * publica a lista, e aí o código do serviço entra à mão via municipalServiceCode.
 */
export function listarServicosMunicipais(): Promise<ServicoMunicipal[]> {
  return listarTudo<ServicoMunicipal>("/fiscalInfo/services");
}

/** Informações fiscais da conta. É o que diz se a emissão está habilitada. */
export function buscarInformacoesFiscais(): Promise<Record<string, unknown>> {
  return request<Record<string, unknown>>("/fiscalInfo");
}

export type Payment = {
  id: string;
  customer: string;
  value: number;
  netValue: number;
  status: string;
  paymentDate: string | null;
  dueDate: string;
};

/**
 * Cobranças efetivamente recebidas na janela. É o que alimenta o RBT12.
 *
 * O Simples apura por competência, e aqui somamos o que entrou (regime de
 * caixa), então o número é aproximação de gestão. Para o rateio do DAS na tela
 * a diferença é pequena; para a apuração real quem manda é o contador.
 */
export async function listarRecebidos(inicio: string, fim: string): Promise<Payment[]> {
  const status = ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"];

  const paginas = await Promise.all(
    status.map((s) =>
      listarTudo<Payment>("/payments", {
        status: s,
        "paymentDate[ge]": inicio,
        "paymentDate[le]": fim,
      }),
    ),
  );

  return paginas.flat();
}

export function listarNotas(params: Record<string, string> = {}): Promise<Invoice[]> {
  return listarTudo<Invoice>("/invoices", params);
}

/**
 * Cria a nota com status SCHEDULED. Ela só vai pra prefeitura na effectiveDate,
 * então agendar com data folgada é o que dá tempo de conferir antes de emitir.
 */
export function agendarNota(nota: NotaAgendada): Promise<Invoice> {
  return request<Invoice>("/invoices", { method: "POST", body: JSON.stringify(nota) });
}

/** Emite agora, sem esperar a effectiveDate. É o botão de aprovar do lote. */
export function autorizarNota(id: string): Promise<Invoice> {
  return request<Invoice>(`/invoices/${id}/authorize`, { method: "POST" });
}

/** Em nota SCHEDULED cancela o agendamento; em AUTHORIZED pede cancelamento à prefeitura. */
export function cancelarNota(id: string): Promise<Invoice> {
  return request<Invoice>(`/invoices/${id}`, { method: "DELETE" });
}
