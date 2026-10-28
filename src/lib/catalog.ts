export type ShortcutBrand = "dynamic" | "sentinel" | "clickup" | "panel" | "propostas" | "cob" | "financeiro" | "placar";

export type Shortcut = {
  id: string;
  /** Nome que o time usa falando */
  name: string;
  /** O que a pessoa vai fazer ali, em uma linha */
  what: string;
  url: string;
  /** Pedaço do endereço mostrado no rodapé do card, pra saber pra onde vai */
  host: string;
  brand: ShortcutBrand;
  /** Aviso curto quando o acesso tem pegadinha */
  note?: string;
};

export type Shelf = {
  id: string;
  title: string;
  hint?: string;
  items: Shortcut[];
};

/** Letra de fundo do card. Serve pra reconhecer o sistema de longe, sem depender de logo. */
export const BRAND_MARK: Record<ShortcutBrand, string> = {
  dynamic: "D",
  sentinel: "S",
  clickup: "C",
  panel: "A",
  propostas: "P",
  cob: "B",
  financeiro: "F",
  placar: "P",
};

export const SHELVES: Shelf[] = [
  {
    id: "dia-a-dia",
    title: "O dia a dia",
    hint: "As cinco telas que resolvem o dia. O resto está no rodapé.",
    items: [
      {
        id: "clickup",
        name: "ClickUp",
        what: "Pedidos, entregas e o chat do time. Todo pedido nasce aqui, na pasta do cliente.",
        url: "https://app.clickup.com/90132645167/home",
        host: "app.clickup.com",
        brand: "clickup",
      },
      {
        id: "dynamic",
        name: "Dynamic",
        what: "A fábrica. A demanda vira tarefa e os 22 agentes produzem.",
        url: "https://paperclip-xgfl.srv1807772.hstgr.cloud",
        host: "paperclip-xgfl",
        brand: "dynamic",
        note: "o endereço ainda tem o nome antigo",
      },
      {
        id: "aprovacoes",
        name: "Aprovações",
        what: "A fila de artes esperando decisão, agrupada por cliente.",
        url: "https://aprovar.srv1807772.hstgr.cloud",
        host: "aprovar",
        brand: "panel",
        note: "só abre com o seu link pessoal, senão dá not found",
      },
      {
        id: "visao",
        name: "Visão",
        what: "Onde cada cliente parou, agora. Uma linha por cliente, uma coluna por etapa.",
        url: "https://aprovar.srv1807772.hstgr.cloud/visao",
        host: "aprovar / visao",
        brand: "panel",
        note: "engoliu a Torre, o Cockpit e o Time de IA, que viraram aba lá dentro",
      },
      {
        id: "sentinel",
        name: "Sentinel",
        what: "Tráfego pago: metas, resultados por cliente e relatórios.",
        url: "https://cob-insight-hub.vercel.app",
        host: "cob-insight-hub",
        brand: "sentinel",
      },
    ],
  },
  {
    id: "gestao",
    title: "Gestão por resultado",
    hint: "O número de cada cliente contra a meta, toda semana.",
    items: [
      {
        id: "placar",
        name: "Placar de Clientes",
        what: "Nota de 0 a 10 de cada cliente contra a meta. É onde se lança o número da semana e se abre a rodada.",
        url: "/placar",
        host: "cob-hub / placar",
        brand: "placar",
        note: "entra com o seu login, a senha do time não abre",
      },
    ],
  },
];

/**
 * menu-enxuto-20260824: eram 11 cards e o time abria vários pra descobrir onde ir.
 * Estes continuam no ar e a um clique, só deixaram de disputar atenção com o dia a dia.
 */
export const SECUNDARIOS: Shortcut[] = [
  {
    id: "propostas",
    name: "Propostas",
    what: "Pedir proposta ao Analista, responder o preço e mandar a peça pro card do CRM.",
    url: "https://propostas.srv1807772.hstgr.cloud",
    host: "propostas",
    brand: "propostas",
  },
  {
    id: "entregas",
    name: "Entregas para revisão",
    what: "A fila do Israel no ClickUp.",
    url: "https://app.clickup.com/90132645167/v/l/li/901328165632",
    host: "app.clickup.com",
    brand: "clickup",
  },
  {
    id: "producao-social",
    name: "Produção social",
    what: "Planejado contra publicado, peça a peça, mês a mês.",
    url: "https://painel-social.srv1807772.hstgr.cloud",
    host: "painel-social",
    brand: "panel",
  },
  {
    id: "notas",
    name: "Notas do mês",
    what: "O lote de NF dos clientes. Pede a segunda senha, só do financeiro.",
    url: "/financeiro/notas",
    host: "financeiro / notas",
    brand: "financeiro",
  },
  {
    id: "manual",
    name: "Como a COB opera",
    what: "O manual do processo: quem faz, onde faz e como faz.",
    url: "https://claude.ai/code/artifact/e301c9b7-b7b8-44e3-8a32-51eead460d76",
    host: "claude.ai",
    brand: "cob",
  },
  {
    id: "design-system",
    name: "Design System COB",
    what: "Tokens, cores e tipografia da marca.",
    url: "https://github.com/COBCRO-PRT/cob-hub/blob/main/docs/Design_System_COB.md",
    host: "github.com",
    brand: "cob",
  },
  {
    id: "site-cob",
    name: "Site da COB",
    what: "A vitrine externa e a página que captura lead.",
    url: "https://cob-site.vercel.app",
    host: "cob-site",
    brand: "cob",
  },
];
