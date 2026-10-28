/**
 * Todos os lugares para onde o hub leva: as telas de dentro e as ferramentas da home.
 * O menu rápido (⌘K) e a barra do jogo leem daqui. Regras em docs/navegacao.md.
 */
import { BRAND_MARK, SECUNDARIOS, SHELVES, type Shortcut } from "./catalog";

export type DestinoGroup = "hub" | "ferramentas";

export interface Destino {
  id: string;
  name: string;
  what: string;
  href: string;
  group: DestinoGroup;
  /** Abre em aba nova (ferramenta de fora, igual ao card da home). */
  external: boolean;
  /** Só aparece para quem é admin. */
  admin?: boolean;
  /** Apelidos que a busca também encontra. */
  keywords?: string;
  /** Ícone das telas do hub; ferramenta usa a letra do card. */
  icon?: "inicio" | "placar" | "rodada" | "missoes" | "mapa" | "temporada" | "notas" | "financeiro";
  mark?: string;
}

/** Abas da barra do jogo, na ordem do mapa. */
export const ABAS = [
  { id: "inicio", label: "Início", href: "/", icon: "inicio" as const },
  { id: "placar", label: "Placar", href: "/placar", icon: "placar" as const },
  { id: "rodada", label: "Rodada", href: "/placar/semana", icon: "rodada" as const },
  { id: "financeiro", label: "Financeiro", href: "/financeiro/notas", icon: "financeiro" as const, admin: true },
];

/** Aba acesa para o endereço atual. */
export function abaAtual(pathname: string): string {
  if (pathname.startsWith("/placar/semana")) return "rodada";
  if (pathname.startsWith("/placar")) return "placar";
  if (pathname.startsWith("/financeiro")) return "financeiro";
  return "inicio";
}

const HUB: Destino[] = [
  { id: "inicio", name: "Início", what: "A tela inicial com todos os atalhos do time.", href: "/", group: "hub", external: false, icon: "inicio", keywords: "home menu atalhos" },
  { id: "placar", name: "Placar de Clientes", what: "Nota de cada cliente contra a meta. Lançar o número da semana.", href: "/placar", group: "hub", external: false, icon: "placar", keywords: "nota meta lancar numero resultado clientes" },
  { id: "rodada", name: "Rodada da semana", what: "Pódio, meta do time, vermelhos e tarefas do ClickUp.", href: "/placar/semana", group: "hub", external: false, icon: "rodada", keywords: "reuniao segunda podio ranking jogo vermelho" },
  { id: "missoes", name: "Missões da semana", what: "O que lançar em cada cliente para virar, chegar no verde ou ganhar o selo.", href: "/placar/semana#missoes", group: "hub", external: false, icon: "missoes", keywords: "missao tarefa virar falta" },
  { id: "mapa", name: "Mapa da carteira", what: "Um quadrado por cliente na cor da nota. Clique para ver a ficha.", href: "/placar/semana#mapa", group: "hub", external: false, icon: "mapa", keywords: "carteira clientes ficha historico" },
  { id: "temporada", name: "Tabela da temporada", what: "XP, nível e conquistas de cada pessoa.", href: "/placar/semana#temporada", group: "hub", external: false, icon: "temporada", keywords: "xp nivel conquista ranking" },
  { id: "notas", name: "Notas do mês", what: "O lote de nota fiscal dos clientes. Pede a segunda senha.", href: "/financeiro/notas", group: "hub", external: false, icon: "notas", admin: true, keywords: "nf nota fiscal asaas emitir" },
  { id: "placar-fin", name: "Placar com valores", what: "O placar com a mensalidade de cada cliente e o valor em risco.", href: "/financeiro/placar", group: "hub", external: false, icon: "financeiro", admin: true, keywords: "mensalidade fee risco dinheiro" },
];

const tool = (s: Shortcut): Destino => {
  const internal = s.url.startsWith("/");
  return {
    id: `tool-${s.id}`,
    name: s.name,
    what: s.what,
    href: s.url,
    group: internal && s.url.startsWith("/placar") ? "hub" : "ferramentas",
    external: !internal,
    admin: s.url.startsWith("/financeiro"),
    keywords: s.host,
    mark: BRAND_MARK[s.brand],
  };
};

/** Tudo, sem repetir o que já está nas telas do hub. */
export function destinos(admin: boolean): Destino[] {
  const hubHrefs = new Set(HUB.map((d) => d.href));
  const tools = [...SHELVES.flatMap((s) => s.items), ...SECUNDARIOS].map(tool).filter((d) => !hubHrefs.has(d.href));
  return [...HUB, ...tools].filter((d) => admin || !d.admin);
}

/** Busca sem acento e sem maiúscula; todas as palavras precisam aparecer. */
export const fold = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function busca(list: Destino[], q: string): Destino[] {
  const words = fold(q).split(/\s+/).filter(Boolean);
  if (!words.length) return list;
  const scored = list
    .map((d) => {
      const name = fold(d.name);
      const all = `${name} ${fold(d.what)} ${fold(d.keywords ?? "")}`;
      if (!words.every((w) => all.includes(w))) return null;
      const score = words.reduce((n, w) => n + (name.startsWith(w) ? 3 : name.includes(w) ? 2 : 1), 0);
      return { d, score };
    })
    .filter((x): x is { d: Destino; score: number } => x !== null);
  return scored.sort((a, b) => b.score - a.score).map((x) => x.d);
}
