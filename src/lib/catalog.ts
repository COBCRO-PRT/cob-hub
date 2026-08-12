export type ShortcutBrand = "dynamic" | "sentinel" | "clickup" | "panel" | "cob";

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
  cob: "B",
};

export const SHELVES: Shelf[] = [
  {
    id: "dia-a-dia",
    title: "O dia a dia",
    hint: "Onde o trabalho acontece, do pedido até a entrega",
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
        id: "entregas",
        name: "Entregas para revisão",
        what: "A fila do Israel. O card nasce sozinho quando o Adrian aprova a última peça.",
        url: "https://app.clickup.com/90132645167/v/l/li/901328165632",
        host: "app.clickup.com",
        brand: "clickup",
      },
    ],
  },
  {
    id: "gestao",
    title: "Gestão",
    hint: "As telas que respondem se a máquina está saudável",
    items: [
      {
        id: "sentinel",
        name: "Sentinel",
        what: "Tráfego pago: metas, resultados por cliente e relatórios.",
        url: "https://cob-insight-hub.vercel.app",
        host: "cob-insight-hub",
        brand: "sentinel",
      },
      {
        id: "torre",
        name: "Torre de controle",
        what: "O que travou: tarefa esquecida, agente parado, rotina desligada.",
        url: "https://aprovar.srv1807772.hstgr.cloud/board",
        host: "aprovar / board",
        brand: "panel",
        note: "só abre com o seu link pessoal",
      },
      {
        id: "cockpit",
        name: "Cockpit",
        what: "Onde o tempo se perde: tempo produzindo contra tempo esperando decisão.",
        url: "https://aprovar.srv1807772.hstgr.cloud/gestao",
        host: "aprovar / gestao",
        brand: "panel",
        note: "só abre com o seu link pessoal",
      },
      {
        id: "time-ia",
        name: "Time de IA",
        what: "Quem trabalha, quem parou e quanto custa de API.",
        url: "https://aprovar.srv1807772.hstgr.cloud/time",
        host: "aprovar / time",
        brand: "panel",
        note: "só abre com o seu link pessoal",
      },
    ],
  },
  {
    id: "materiais",
    title: "Materiais do time",
    hint: "O que consultar quando bater dúvida",
    items: [
      {
        id: "manual",
        name: "Como a COB opera",
        what: "O manual do processo, passo a passo: quem faz, onde faz e como faz.",
        url: "https://claude.ai/code/artifact/e301c9b7-b7b8-44e3-8a32-51eead460d76",
        host: "claude.ai",
        brand: "cob",
      },
      {
        id: "design-system",
        name: "Design System COB",
        what: "Tokens, cores e tipografia. A fonte da verdade visual da marca.",
        url: "https://github.com/COBCRO-PRT/cob-hub/blob/main/docs/Design_System_COB.md",
        host: "github.com",
        brand: "cob",
      },
      {
        id: "site-cob",
        name: "Site da COB",
        what: "A vitrine externa e a página que captura lead do comercial.",
        url: "https://cob-site.vercel.app",
        host: "cob-site",
        brand: "cob",
      },
    ],
  },
];
