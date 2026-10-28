# Design system do COB Hub (direção Arena)

Pedido do Matheus em 28/10/2026: "quero o máximo de refinamento premium do sistema, estilo app premium".
Estudo com diagnóstico, referências e três direções: https://claude.ai/artifact/Ac4owdojtC6zDAuxDmA2tE
Decisões dele no mesmo dia: direção **Arena inteira**, Início vira **tela de partida de app**, **Notas entram**.

Este documento é a fonte da verdade do visual do hub. O código segue o que está aqui. Ele substitui
`docs/Design_System_COB.md` (acento azul, Inter Tight, sem shadcn), que descrevia outro produto e deve ser apagado
na fase 1.

## 1. Intenção

O hub funciona e tem identidade (escuro, ciano, Onest), mas não tem sistema: 22 tamanhos de fonte, 25 rótulos
diferentes, 5 superfícies, 4 modais, 11 de 15 componentes instalados sem uso, três margens esquerdas. Cada tela
parece feita por uma mão diferente. Premium é tomar cada decisão visual uma vez e repetir em todo lugar.

A direção Arena traz o jogo para a frente em todas as telas: a nota do cliente é um anel, as superfícies têm
relevo, o pódio tem peso, o nível mais alto é dourado. É o Apple Fitness aplicado à carteira, com a seriedade
de um painel de operação. Nunca desenho animado.

## 2. Objetivos, não objetivos, anti-objetivos

**Objetivos**
- Todas as telas (Início, Placar, Rodada, Notas, login, HUD, menu rápido) saem do mesmo conjunto de tokens e
  primitivos. Nenhuma cor, tamanho ou raio inventado na tela.
- Toda mudança de estado interpola (reordenação, filtro, número, aparecer e sumir).
- Toda ação responde em até 100ms (afundar ao apertar, estado pendente, otimismo onde for seguro).
- Carregando, vazio e erro têm desenho próprio em toda tela. Nada fica em "…" para sempre.
- Celular de 390px e toque de verdade (dica de hover vira folha; nada escondido atrás da barra inferior).

**Não objetivos**
- Não muda regra de negócio: régua do placar, pontos da rodada, missões, ClickUp, login, cron. Zero alteração em
  `src/lib/placar/*`, `src/lib/clickup.ts`, `src/lib/gate*.ts`, rotas de API. **Única exceção, aditiva:**
  `jogador.ts` e `/api/placar/eu` passam a devolver `team: { green, total, goalPct }` calculado só do store
  (nunca do ClickUp), para o anel do cartão da rodada no Início. Nenhuma outra rota muda.
- Não muda a navegação: abas, ⌘K, teclas numéricas, recentes, HUD. `docs/navegacao.md` continua valendo.
- Não troca identidade: ciano `#00e5ff`, Onest, fundo escuro, logo.
- Não adiciona dependência nova. `motion`, `lucide-react`, `sonner` e `shadcn/dialog` já resolvem tudo.
- Não publica o trabalho de NF que está em `~/Projects/cob-hub` (fora deste escopo; produção segue vindo do
  backup `~/Projects/_backups/cob-hub-2026-10-27-jogo`).

**Anti-objetivos (o que tornaria isto um fracasso mesmo funcionando)**
- Virar "SaaS de IA 2024": pilha de efeitos, glow em tudo, grain, letra gigante atrás de card, ícone em círculo
  como enfeite. Régua anti-IA (`~/Projects/cob-ds/playbook-anti-ia.md`) com nota acima de 3.
- Anel, relevo e brilho repetidos 42 vezes numa lista até cansar. Um gesto-herói por tela; o resto é quieto.
- Perder densidade: a lista do Placar mostra pelo menos 12 clientes por tela a 1440×900 (linha de até 64px
  com gap de 6px). A carteira inteira de relance é papel do mapa da Rodada, não da lista.
- Fee da COB ou R$ da empresa em tela que o time vê (`/placar` e `/placar/semana`). Só `/financeiro/*` tem valor.

## 3. Restrições

- Next.js 16.2 App Router com Turbopack, Tailwind v4, `motion` v12 (`motion/react`), lucide-react 1.21, React 19.
- Em dash proibido em qualquer texto de interface, doc ou commit.
- Interface em pt-BR, código e identificadores em inglês.
- Deploy só com OK explícito do Matheus no chat, com comparação de produção antes e depois e backup atualizado.
- `prefers-reduced-motion` respeitado globalmente.
- Contraste mínimo 4,5:1 em qualquer texto que carregue informação; 3:1 em rótulo decorativo e ícone.

## 4. Tokens

Todos os tokens vivem em `src/app/globals.css`, como variáveis CSS expostas ao Tailwind v4 via `@theme`.
Componentes usam só as classes derivadas (`bg-surface-1`, `text-mute`, `rounded-card`...). **Hex cru em
componente é bug.** Exceções: `Logo.tsx` e confete, que têm cor própria por desenho.

### 4.1 Cor

| Token | Valor | Uso |
|---|---|---|
| `bg` | `#07080a` | fundo da página |
| `surface-1` | `#0c0e11` | card em repouso, HUD, folha |
| `surface-2` | `#11141a` | card dentro de card, popover, item ativo |
| `surface-3` | `#161a21` | hover de superfície interativa |
| `line` | `rgba(255,255,255,.08)` | borda em repouso e divisor |
| `line-strong` | `rgba(255,255,255,.14)` | borda em hover e em foco de card |
| `fg` | `#f2f4f7` | texto principal |
| `mute` | `#a3abb5` | texto secundário (6,9:1) |
| `dim` | `#6f7883` | rótulo e placeholder (4,6:1); nunca abaixo disto em texto |
| `accent` | `#00e5ff` | ação principal, item ativo, foco |
| `accent-fg` | `#04141a` | texto sobre o acento |
| `accent-soft` | `rgba(0,229,255,.10)` | fundo do item ativo e do brilho do gesto-herói |
| `accent-text` | `#7ff2ff` | ciano em texto corrido (link, destaque). Nunca em fundo |
| `good` | `#34d399` | verde |
| `warn` | `#fbbf24` | amarelo |
| `bad` | `#f87171` | vermelho |
| `none` | `#6f7883` | cinza (sem leitura) |
| `gold` | `#f2c66d` | só nível Lenda e selo de 1º lugar da temporada |

Regras:
- Os quatro tons semânticos têm **um** valor. Fundo suave é sempre o tom a 12% (`color-mix` ou `/12`). Borda suave
  é o tom a 35%. Não existe "emerald-300" nem "red-500/25".
- Acento aparece no máximo em: 1 botão principal por tela, item ativo da navegação, anel de foco, 1 brilho do
  gesto-herói. Mais que isso é decoração e sai.
- Hover do botão principal clareia (`accent` com 12% de branco por cima), nunca escurece para azul.
- Erro é sempre `bad`. Aviso é sempre `warn`. Informação é `accent-soft` com texto `mute`.
- `color-scheme: dark` declarado em `:root` para controles nativos e barras de rolagem.

### 4.2 Tipo

Fonte de texto Onest; mono Geist Mono. Mono só para: identificador (host, id, código), valor de atalho (`kbd`),
rótulo de eyebrow. **Número nunca é mono.** Número é Onest com `font-variant-numeric: tabular-nums`.

| Papel | Tamanho / altura | Peso | Observação |
|---|---|---|---|
| `display` | 32px / 1.1 | 800 | título de tela (H1). Um por tela. Mobile 26px |
| `title` | 20px / 1.2 | 700 | título de seção e de modal |
| `subtitle` | 16px / 1.35 | 600 | nome de card, de cliente, de pessoa |
| `body` | 14px / 1.5 | 400 ou 500 | texto corrido, meta, descrição |
| `caption` | 12px / 1.4 | 500 | linha secundária, legenda |
| `label` | 11px / 1 | 500, mono, caixa alta, tracking .12em | eyebrow e cabeçalho de coluna |
| `metric-lg` | 40px / 1 | 700, tabular | número herói da tela (KPI principal, meta do time) |
| `metric` | 28px / 1 | 700, tabular | KPI de card |
| `metric-sm` | 16px / 1 | 700, tabular | nota dentro do anel, pontos |

Tracking: `display` e `title` com -0,03em; `label` com .12em; o resto 0. Seis tamanhos de texto e três de
métrica. Nenhum `text-[13.5px]` sobrevive.

Negrito inline em texto corrido é `font-semibold` (600). `<b>` cru não existe.

### 4.3 Forma

Raios concêntricos: o raio de dentro é o de fora menos o padding.

| Token | Valor | Uso |
|---|---|---|
| `radius-sm` | 8px | campo, pílula quadrada, score pequeno |
| `radius-md` | 12px | botão quadrado, item de lista com fundo, missão |
| `radius-card` | 16px | card, KPI, linha de cliente |
| `radius-panel` | 20px | modal, folha, menu rápido, painel do pódio |
| `full` | 999px | botão pílula, chip, avatar, barra |

Borda 1px `line`. Relevo da Arena: todo `surface-1` e `surface-2` com fundo tem `box-shadow: inset 0 1px 0
rgba(255,255,255,.06)` (brilho de 1px no topo). Sombra externa só em popover, modal e folha: uma só,
`0 24px 60px -24px rgba(0,0,0,.7)`. Nada de `shadow-md` em card.

Blur de fundo só em HUD, barra inferior e overlay de modal.

### 4.4 Espaço e grade

Escala de 4px. Padding de card 16px (`sm`) e 20px (`md`). Gap de lista 8px, de grade 12px, de seção 28px,
entre blocos da tela 40px.

**Um contêiner para tudo:** `max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-10`, igual ao HUD. Início, Placar,
Rodada, Notas e login usam o mesmo. Topo da tela `pt-8`, rodapé `pb-24` (o `HudSpacer` já cobre a barra
inferior do celular). Âncoras com `scroll-mt-20` em todas as telas.

Ordem de camadas (z-index), do fundo para o topo: conteúdo 0, barra de ação fixa 30, HUD e barra inferior 40,
folha e popover 50, modal 60, toast 70, menu rápido 80, revelação 90, confete 100. A barra de ação das Notas
e o toast ficam acima da barra inferior (`bottom` = altura da barra + 12px no celular).

### 4.5 Movimento

Um `MotionConfig reducedMotion="user"` no layout raiz. Nenhum `animate-pulse` ou `transition` CSS sem o par
`motion-safe:`.

| Token | Valor | Uso |
|---|---|---|
| `spring` | `type: spring, stiffness 380, damping 32` | entrada de painel, reordenação (`layout`), folha, menu |
| `fast` | 120ms, `[0.32,0.72,0,1]` | hover, afundar ao apertar, troca de aba |
| `base` | 200ms, `[0.32,0.72,0,1]` | aparecer e sumir de texto, aviso, toast |
| `slow` | 450ms, `[0.22,1,0.36,1]` | barra, anel e número ao receber dado |

Regras:
- Lista reordena com `layout` + `AnimatePresence` (Placar, mapa, missões, tabela).
- Número que muda desliza do valor antigo para o novo (`animate` sobre o valor); conta do zero **só** na primeira
  pintura da sessão da tela. O refresh de 30s/60s nunca reinicia contagem.
- Anel e barra enchem uma vez ao entrar na tela; depois só interpolam entre valores.
- Apertar: `whileTap scale .98` em botão, card clicável e chip.
- Toda `transition-*` CSS fica atrás de `motion-safe:`.

### 4.6 Ícones

lucide-react, `strokeWidth 1.75`, três tamanhos: 16 (inline e botão), 18 (lista e HUD), 20 (título e vazio).
Seta de navegação é `ChevronLeft`/`ChevronRight`, nunca o caractere "‹ ›". "abrir →" vira `ArrowUpRight`.
Ícone decorativo tem `aria-hidden`.

## 5. Primitivos

Ficam em `src/components/ui/` e substituem os 15 arquivos shadcn de hoje. Dos 15, só `dialog.tsx` (base do
`Modal`) e `sonner.tsx` (tema do `Toast`) continuam, reescritos com os tokens. Os outros 13 são apagados.
Classes são compostas com `cn()` (tailwind-merge), nunca com template string, para que uma variação consiga
sobrescrever a base.

| Primitivo | Props principais | Notas |
|---|---|---|
| `Button` | `variant: primary / ghost / soft / danger / link`, `size: sm (32) / md (36) / lg (44)`, `pending`, `icon`, `iconEnd` | pílula. `primary` é o único com fundo de acento; em lista, só a linha que precisa de ação recebe `primary`, as outras `ghost`. `pending` troca o rótulo por spinner e mantém a largura. Botão principal com ícone à direita usa o ícone dentro de um círculo de 22px (`accent-fg` a 18%): é a assinatura da Arena |
| `Field` | `label`, `hint`, `error`, `as: input / select / textarea` | 16px no celular (iPhone não dá zoom), 14px em `sm`. `aria-invalid` e `aria-describedby` ligados ao erro. `radius-sm`. Foco: borda `accent` + anel `accent-soft` |
| `Surface` | `level: 1 / 2`, `interactive`, `glow` | card com relevo. `interactive` ganha hover (`surface-3`, `line-strong`) e `whileTap`. `glow` liga o brilho radial de acento (só o gesto-herói) |
| `Label` | `tone: dim / accent` | eyebrow. Substitui as 25 variações |
| `SectionTitle` | `title`, `hint`, `right` | `title` 20/700 + `hint` em `mute` + slot à direita. Substitui o eyebrow solitário de 11px que titula seções no Placar e na Rodada hoje |
| `Metric` | `value`, `unit`, `label`, `sub`, `tone`, `size: lg / md`, `delta` | KPI. Valor Onest tabular, unidade em `caption` ao lado, `delta` com seta e tom. Conta uma vez; depois desliza |
| `Score` | `value 0-10 ou null`, `tone`, `size: 32 / 40 / 56`, `trail?` | **o anel da Arena**. SVG com trilho `line` e arco no tom; valor dentro em `metric-sm`. `null` = anel cinza tracejado com "s/n". Um `title` no desktop e folha no toque |
| `Trail` | `tones[8]`, `size` | 8 barrinhas da história (hoje `TrailDots`), altura = nota, cor = tom |
| `Pill` | `tone`, `icon` | chip de estado. `full`, 12/600 |
| `Bar` | `value`, `max`, `tone`, `size: sm (4) / md (8)`, `marker` | única barra de progresso. `marker` é o traço da meta |
| `Empty` | `title`, `text`, `action` | vazio com verbo. Uma implementação |
| `Notice` | `tone: info / warn / bad`, `title`, `action` | aviso inline. Uma implementação |
| `Modal` | `title`, `size: sm / md`, `onClose` | centrado no desktop, folha inferior no celular (`sm`). Overlay `bg/80` + blur. Prende foco, trava rolagem, fecha no Esc, botão fechar "Fechar". Entrada `spring`. Substitui os 4 modais |
| `Skeleton` | `lines`, `shape` | brilho suave em `surface-2`. Toda tela tem o seu (KPIs + 6 linhas no Placar; meta + pódio na Rodada; 4 linhas nas Notas) |
| `Toast` | via `toast()` do sonner | único sistema, posição `bottom-center` acima da barra inferior, tema pelos tokens. O toast de missão cumprida da Rodada passa a usar este, com o confete por cima |
| `Kbd` | | um estilo: mono 11, borda `line-strong`, `radius-sm` 4px |
| `PlayerLevel` | `xp`, `level`, `size` | barra de nível do cartão do jogador (HUD, Início, tabela da temporada). Lenda em `gold` |

`tones.ts` continua existindo só como mapa `Tone -> classes de token` (`text-good`, `bg-good/12`,
`border-good/35`). `btnPrimary`, `btnGhost`, `btnDanger`, `fieldLabel` e `fieldInput` somem; quem usava passa a
usar `Button` e `Field`.

## 6. Telas

Cada tela tem **um** gesto-herói (o único lugar com brilho de acento ou escala maior). O resto obedece aos
tokens e fica quieto.

### 6.1 HUD e menu rápido
- Mesma estrutura de `docs/navegacao.md`. Muda só a pele: `surface-1` com blur, `line` embaixo, aba ativa com
  sublinhado de acento que desliza (desktop **e** celular, mesmo `layoutId`).
- Cartão do jogador: avatar, nome, `PlayerLevel`. Lenda em `gold`.
- Menu rápido: `Modal`-like com `radius-panel`, mesmo overlay, mesma entrada. Ícone de destino com `strokeWidth
  1.75`, item ativo `surface-2` com borda `line-strong`.
- "…" de carregamento vira `Skeleton` de 1 linha; falha do `/api/placar/eu` mostra o chip sem nível e um
  "tentar de novo" no menu.

### 6.2 Início (tela de partida de app)
- Sai o título de landing ("Tudo que o time usa, em um lugar só"), o parágrafo e as letras gigantes atrás dos
  cards.
- Ordem: saudação curta em `title` ("Boa tarde, Matheus" por hora do dia) + data e rodada em `caption`; o
  **cartão da rodada** (gesto-herói: `Surface glow`, anel grande da meta do time com `Score size 56`, missões
  abertas, "fecha em", botões Continuar e Lançar); depois as prateleiras. O anel usa o `team` do
  `/api/placar/eu`. "Lançar números" abre `/placar`, como hoje.
- Card de ferramenta: `Surface interactive`, nome em `subtitle`, descrição em `body` `mute`, rodapé com host em
  mono `caption` e tecla em `Kbd`. Nota de atenção em `Pill warn`, não em texto âmbar solto.
- Sem login: cartão "Entre para jogar a rodada" com o mesmo desenho e um `Button primary`.
- Mantém `TeclasDaHome` e os ids de destino.

### 6.3 Placar de Clientes
- Cabeçalho: `Label` + `display` + navegação de semana (`Button ghost` quadrados com Chevron, período em
  `subtitle`, legenda em `caption`) + "Rodada da semana" como `Button soft` com troféu + `Button primary` "Novo
  cliente". Esse é o único `primary` fixo da tela.
- KPIs: 4 `Metric size lg` em `Surface`, 2 colunas no celular. "Nota média" sem leitura mostra `Metric` com
  valor "s/n" em `dim` e sub "0 de 42 com nota", nunca a string mono.
- Distribuição: `Bar md` segmentada nos 4 tons com legenda em `Pill`; segmento cresce com `slow`.
- Filtro de donos: chips `Pill`-like com `Score 32` do dono + nome + contagem; ativo em `surface-2` + borda
  `line-strong` (uma só linguagem de "selecionado" para o hub inteiro; a mesma vale para `PersonFilter` e a tabela
  da temporada).
- Lista: **gesto-herói é o anel**. Cada linha é `Surface interactive` de `radius-card` com `Score 40` à
  esquerda, nome em `subtitle` + dono/escopo em `caption`, meta e resultado em `body` tabular, `Trail`, e ação.
  Linhas reordenam com `layout`. Ação: `Button primary sm` "Lançar" só quando falta o número da semana; se já
  tem, `Button ghost sm` "Editar" e o lançamento vira "Lançado" em `Pill good`. Assim o ciano aparece só onde há
  trabalho a fazer.
- Linha vermelha: borda esquerda de 2px em `bad` dentro do raio (não um strip quadrado fora).
- Dica da nota (`title`) vira folha `Modal sm` no toque com a conta da nota.
- Carregando: `Skeleton`. Vazio: `Empty` com verbo ("Cadastre o primeiro cliente"). Erro: `Notice bad` com
  "tentar de novo". Dados antigos ficam na tela enquanto atualiza, com `caption` "atualizando…" ao lado do período.
- Diálogos de lançar, editar e novo cliente usam `Modal` + `Field` + `Button pending`. A nota do cliente (0 a
  10) continua campo numérico com decimal (a base já tem 7,5), com `inputmode="decimal"`.
- Vista do dono (`/financeiro/placar`): mesmo `PlacarBoard` e **tudo que ela mostra hoje continua**: os 4 KPIs
  em R$ (mensalidade em risco, sem leitura, nota média, mensalidade no placar), o R$ por faixa na distribuição e
  a coluna de valor na linha. Muda só a pele: `Metric` e `body` tabular. Nada é removido.

### 6.4 Rodada da semana
- Cabeçalho igual ao do Placar (mesmo componente `PageHeader` interno a `components/placar`).
- Trilha da temporada: 14 segmentos em `Bar sm`, rodadas fechadas em `accent`, atual pulsando (`motion-safe`),
  futuras em `line`. Datas em folha no toque.
- **Gesto-herói: meta do time + pódio** num `Surface glow` único. Anel grande (`Score 56`, mas em percentual:
  verdes/total contra a marca de 70%) à esquerda, "faltam N no verde" em `title`, e o pódio à direita com três
  colunas de altura proporcional ao XP, 1º lugar com `gold` fino no topo. Entrada com `spring` escalonada.
- Tabela da temporada: linhas `Surface` com `PlayerLevel`, XP em `metric-sm`, selos como ícones 18px em `mute`
  (desbloqueado em `fg`, Lenda em `gold`). Pessoa selecionada: `surface-2` + `line-strong`.
- Missões: a de **virada** (+5) é maior (ocupa 2 colunas, `Surface glow` leve com anel do cliente e a conta do
  que falta); as de +2 e +1 são cards normais de 1 coluna. Mostra 6 e "ver todas". Missão cumprida: `Pill good`
  "cumprida" + toast + confete (único lugar com confete).
- Vermelhos com plano no ClickUp: lista `Surface` com `Score 40`, link da tarefa como `Button link` com
  `ArrowUpRight`, prazo em `Pill` (`warn` se < 24h, `bad` se vencido).
- Mapa da carteira: grade de `Score 40` + nome em `caption`, filtro por pessoa com a mesma linguagem de
  selecionado. Clique abre a folha do cliente (`Modal sm`).
- Seções: todas com `SectionTitle`; nenhuma seção "em caixa" além das que o gesto define. Divisor é gap de 40px,
  não `border-t`.
- Revelação (segunda de manhã): mantém o roteiro, com `display` para o título, `Metric lg` para o número e o
  pódio do gesto-herói. Botão "Rever a revelação" vira `Button link` no rodapé da tela.
- Erro de leitura da rodada em `Notice bad` (hoje é âmbar). Resultado de ação em toast.

### 6.5 Notas do mês (`/financeiro/notas`)
- Mesmo contêiner e `PageHeader`. Faixa de sandbox vira `Notice info` dentro do contêiner.
- Seletor de competência em `Field select` + `Button ghost` "Ver".
- Pendências de configuração em `Notice warn` com lista; falha em `Notice bad`.
- Tabela: cabeçalho em `label`, linhas com fio `line`, valores tabulares, selo de status em `Pill`.
- `loading.tsx` com `Skeleton` e `error.tsx` com `Notice bad` + "tentar de novo".
- Botões de emitir com `pending` (via `useFormStatus`). "Cancelar nota" abre `Modal sm` de confirmação com o
  número da nota e o valor; só então cancela.
- Barra de ação fixa acima da barra inferior do celular.

### 6.6 Login (`/entrar`, `/placar/entrar`, `/financeiro/entrar`)
- Um componente `LoginCard` para os três: logo, `title`, texto `mute`, `Field` (nome e senha ou só senha),
  `Button primary lg pending`, erro em `Notice bad` ligado ao campo. `Surface` de 400px centrada.

## 7. Estados e feedback

- **Carregando:** `Skeleton` com a forma da tela. Nunca "Carregando…" em texto. Nunca "…" solto.
- **Vazio:** `Empty` com título, uma frase e um verbo.
- **Erro:** `Notice bad` com o que houve e uma saída. Dados antigos ficam na tela.
- **Ação:** botão em `pending`; sucesso em toast de 3s; erro em `Notice` inline perto do campo.
- **Irreversível** (cancelar nota, apagar cliente, fechar rodada agora): `Modal sm` de confirmação com o nome do
  que vai mudar. O "clique duas vezes" atual sai.
- **Atualização em segundo plano** (30s e 60s): nada pisca; linhas deslizam, números deslizam, `caption`
  "atualizando…" aparece e some.

## 8. Celular e toque

- 390px é a largura de teste. Nada rola na horizontal.
- Dica de hover (`title`) não é fonte de informação. O que hoje está em `title` (conta da nota, datas da trilha,
  sequência, descrição de link) vai para uma folha `Modal sm` ou para texto visível.
- Alvo de toque mínimo 44px em botão e linha clicável.
- Hover e levantar de card só sob `@media (hover: hover)`.
- Barra de ação fixa e toast acima da barra inferior.
- Modal vira folha inferior em `sm`.

## 9. Acessibilidade e régua anti-IA

- Foco visível único: `outline 2px accent, offset 2px` em tudo que é clicável. O `outline-ring/50` global sai.
- Contraste: texto informativo ≥ 4,5:1 (`mute`, `fg`); `dim` só em rótulo e placeholder.
- `aria-label` em pt-BR (o "Close" do dialog some). `role=alert` em erro de formulário.
- Régua anti-IA antes de publicar, nota alvo ≤ 3: uma ideia visual por tela, teto de 5 efeitos por tela, sem
  letra gigante, sem ícone em círculo decorativo, sem glow fora do gesto-herói.

## 10. Critérios de pronto (objetivos, medidos no código e no navegador)

| Critério | Hoje | Pronto |
|---|---|---|
| Tamanhos de fonte em px no código de telas | 22 | ≤ 9 (6 texto + 3 métrica) |
| Hex cru fora de `globals.css`, `Logo.tsx` e confete | ~120 | 0 |
| Opacidades de borda | 8 | 2 |
| Superfícies opacas | 5 | 4 tokens (`bg` + 3 níveis) |
| Implementações de modal | 4 | 1 |
| Arquivos em `components/ui` sem uso | 11 | 0 |
| Margens esquerdas a 1440px | 3 | 1 |
| Telas com skeleton | 0 | 5 (Início logado, Placar, Rodada, Notas, menu rápido) |
| `transition`/`animate` sem `motion-safe` | 6 | 0 |
| Elementos clicáveis sem `focus-visible` | 12 grupos | 0 |
| `typecheck`, `lint`, `build` | passam | passam |
| Console no navegador real | limpo | limpo |
| Rolagem horizontal a 390px | nenhuma | nenhuma |
| axe (cdnjs, no Chrome real) | não medido | 0 sério ou crítico |
| Nota anti-IA | ~5 | ≤ 3 |

## 11. Fases (cada uma publicável)

1. **Fundação:** tokens em `globals.css`, `MotionConfig`, primitivos de `components/ui`, apagar os mortos e os
   `btn*`/`field*`, `PageHeader`, contêiner único, `color-scheme`. Telas continuam funcionando com os primitivos
   novos ligados por baixo (sem mudar desenho ainda). Build e navegador verdes.
2. **Telas:** Início, Placar, Rodada (com a Revelação), HUD e menu rápido, Notas, login, na ordem. Uma tela por
   commit local; verificação no navegador a cada uma.
3. **Toque:** micro-interações, folhas no celular, colisões de barra, contador que não reinicia, hover guards.
4. **Prova e deploy:** 1440 e 390 no Chrome real, axe, régua anti-IA, comparação de produção antes e depois,
   backup, deploy com OK do Matheus.

## 11.1 Onde o código vive

Decisão do Matheus (28/10): ver pergunta no chat. Hoje a cópia de trabalho é `$S/cob-hub-deploy`, idêntica ao
backup `~/Projects/_backups/cob-hub-2026-10-27-jogo`, sem git. `~/Projects/cob-hub` é o repositório, mas está
num ponto anterior (só NF, sem placar, HUD e rodada). O "commit por tela" da fase 2 acontece na árvore que ele
escolher; sem git, cada tela fecha com um backup datado em `~/Projects/_backups/`.

## 12. O que fica para quem constrói

- Nome exato das classes de token no `@theme` e o mecanismo (`@theme` puro ou `@theme inline` com variáveis).
- Implementação do anel (`Score`): SVG com `stroke-dasharray` animado via `motion`, ou `conic-gradient` com
  máscara. Critério: 42 anéis numa lista não podem custar mais de 16ms por frame no scroll.
- Como o número "desliza" (`useMotionValue` + `animate` ou `useSpring`).
- Ordem interna dos commits dentro de cada fase.
- Textos de vazio, erro e confirmação, seguindo o tom das telas atuais (direto, em pt-BR, sem rodeio).
- Como o `Skeleton` de cada tela é desenhado, desde que tenha a forma do conteúdo.

## 13. Decisões que eu (Claude) tomei e deixo anotadas

- Acento continua ciano `#00e5ff` (o preset `cob` do @cob/ds é lima; o hub segue a identidade das páginas e
  sites recentes, como o Matheus pediu em 27/10).
- Mono sai de todo número. Era a maior causa do "cara de terminal" nos KPIs.
- `gold` existe só para Lenda e 1º da temporada. Fora disso, dourado é proibido.
- Confete só na missão cumprida e na revelação. Não há confete em "verde" nem em "lançado".
- O "Lançar" em ciano aparece só onde falta número. Antes aparecia 42 vezes.
- Linhas do Placar continuam cards (Arena), mas com raio `card` e relevo, sem borda de cor fora do raio.
  Altura máxima 64px e gap 6px: Arena sem virar álbum de figurinhas.
- Notas entram **sobre a versão que está em produção** (a do backup de 27/10). O trabalho de NF em
  `~/Projects/cob-hub` (117 linhas diferentes em `notas/page.tsx`, 69 em `acoes.ts`) adota os primitivos novos
  quando for mesclado; o custo desse merge é conhecido e aceito.
- Seção "Como a nota sai" do Placar continua, em `SectionTitle` + `body`.
- Notas entram com confirmação de cancelamento, por ser ação fiscal irreversível.
- Nenhuma dependência nova. Se o anel exigir, fica SVG puro.
