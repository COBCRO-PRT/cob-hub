# Hub Premium (direção Arena) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Levar o COB Hub ao padrão de app premium na direção Arena, sem mudar regra de negócio nem navegação.

**Architecture:** Tokens de verdade em `globals.css` (Tailwind v4 `@theme`), 16 primitivos em `src/components/ui/` que substituem os 15 shadcn e os `btn*`/`field*` de `tones.ts`, e as telas reescritas sobre eles, uma por commit. Um script de medida (`scripts/ds-check.mjs`) é o verificador objetivo dos critérios de pronto do spec e roda antes de cada commit.

**Tech Stack:** Next.js 16.2 App Router (Turbopack), React 19, Tailwind v4, `motion` v12 (`motion/react`), lucide-react 1.21, sonner, `@base-ui/react` dialog (já instalado, base do `Modal`). Nenhuma dependência nova.

**Spec:** `docs/design-system.md` (seções citadas como §n).

**Árvore:** worktree `~/Projects/cob-hub-producao`, branch `premium` (de `producao`, que é o que está no ar). Commits locais; nada de push nem deploy sem OK do Matheus.

## Global Constraints

- Nenhum hex cru fora de `src/app/globals.css`, `src/components/Logo.tsx` e o confete de `Revelacao.tsx` (§4).
- Seis tamanhos de texto (`display 32`, `title 20`, `subtitle 16`, `body 14`, `caption 12`, `label 11`) e três de métrica (`40`, `28`, `16`). Nenhum `text-[Npx]` em tela (§4.2).
- Número nunca em mono; sempre `tabular-nums` (§4.2).
- Acento no máximo em: 1 botão principal por tela, item ativo, foco, 1 brilho do gesto-herói (§4.1).
- Um gesto-herói por tela; teto de 5 efeitos por tela; nota anti-IA ≤ 3 (§9).
- Toda transição CSS atrás de `motion-safe:`; `MotionConfig reducedMotion="user"` no layout (§4.5).
- Contêiner único `max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-10`, `pt-8 pb-24` (§4.4).
- Em dash proibido em qualquer texto. Interface em pt-BR, código em inglês.
- Zero alteração em `src/lib/placar/*` (exceto o campo `team` aditivo em `jogador.ts`), `src/lib/clickup.ts`, `src/lib/gate*.ts` e rotas de API (exceto `/api/placar/eu` que expõe `team`) (§2).
- Nenhuma tela do time (`/placar`, `/placar/semana`) mostra R$ (§2).
- `typecheck` (`npx tsc --noEmit`), `lint` e `build` passam em todo commit. `npm run ds:check` passa a partir do commit que ativa cada limite.
- Deploy só com OK explícito do Matheus no chat, após comparação de produção antes e depois e backup atualizado.

## Review Focus

1. **Lista de 42 clientes reordenando a cada 30s com `layout`:** uma linha em que o usuário está com o modal aberto não pode pular nem perder o modal. Teste em Task 12.
2. **`/api/placar/eu` falhando (401 após expirar a sessão, 500):** HUD e Início mostram chip sem nível e "tentar de novo"; nunca "…" eterno. Teste em Task 10.
3. **Cliente sem meta e sem leitura (`score null`):** `Score` desenha anel cinza tracejado com "s/n" em todos os tamanhos, `Metric` mostra "s/n", nada quebra em `toFixed`. Teste em Task 5.
4. **Celular 390px com barra inferior:** barra de ação das Notas, toast e folha (`Modal sm`) ficam acima da barra; nada rola na horizontal. Teste em Task 16 e 18.
5. **`prefers-reduced-motion: reduce`:** nenhuma animação roda, contadores pintam o valor final, a revelação ainda é legível. Teste em Task 3 e 13.

---

## Mapa de arquivos

Criar:
- `scripts/ds-check.mjs` (verificador dos critérios de pronto)
- `src/components/ui/button.tsx`, `field.tsx`, `surface.tsx`, `label.tsx`, `section-title.tsx`, `metric.tsx`, `score.tsx`, `trail.tsx`, `pill.tsx`, `bar.tsx`, `empty.tsx`, `notice.tsx`, `modal.tsx`, `skeleton.tsx`, `kbd.tsx`, `player-level.tsx`, `index.ts`
- `src/components/ui/motion.ts` (tokens de movimento em TS: `spring`, `ease`, `dur`)
- `src/components/placar/PageHeader.tsx`
- `src/components/LoginCard.tsx`
- `src/app/financeiro/notas/loading.tsx`, `error.tsx`
- `src/components/hud/PlayerCard.tsx` (extraído do Hud)

Modificar:
- `src/app/globals.css` (tokens), `src/app/layout.tsx` (MotionConfig, Toaster), `src/lib/cn.ts` (novo, `clsx` + `tailwind-merge` já vêm com shadcn)
- `src/components/placar/tones.ts` (só `TONE_STYLE` por token), `PlacarBoard.tsx`, `PlacarDialogs.tsx`, `SemanaBoard.tsx`, `semana/*.tsx`
- `src/components/hud/Hud.tsx`, `MenuRapido.tsx`, `Continuar.tsx`, `DestinoIcon.tsx`, `usePlayer.ts`
- `src/components/Tile.tsx`, `ShelfRow.tsx`, `src/app/page.tsx`
- `src/app/financeiro/notas/page.tsx`, `src/app/{entrar,placar/entrar,financeiro/entrar}/page.tsx`
- `src/lib/placar/jogador.ts` e `src/app/api/placar/eu/route.ts` (campo `team`)

Apagar:
- `docs/Design_System_COB.md`
- `src/components/ui/{avatar,badge,card,dropdown-menu,input,label,select,separator,sheet,tabs,tooltip}.tsx` (os 11 mortos; `dialog.tsx` vira base do `modal.tsx`, `sonner.tsx` é reescrito, `skeleton.tsx` e `button.tsx` são substituídos)
- deps `gsap`, `recharts`, `next-themes`, `class-variance-authority` se sem uso após a fase 1 (`npm uninstall`)

---

## Fase 1: Fundação

### Task 1: Verificador `ds-check`

**Files:**
- Create: `scripts/ds-check.mjs`
- Modify: `package.json` (script `"ds:check": "node scripts/ds-check.mjs"`)

**Interfaces:**
- Produces: `npm run ds:check` sai com código 1 e imprime cada violação `arquivo:linha: regra` quando qualquer limite estoura. Limites lidos de um objeto `LIMITS` no topo do script.

- [ ] **Step 1: Escrever o script** com estas medidas sobre `src/**/*.{ts,tsx}` (excluindo `src/components/ui`, `globals.css`, `Logo.tsx`, e as linhas de confete de `Revelacao.tsx` marcadas com `// ds-allow`):
  - `hex`: regex `#[0-9a-fA-F]{3,8}\b` em className/style. Limite 0.
  - `pxText`: `text-\[\d+(\.\d+)?px\]`. Limite 0.
  - `monoNumber`: `font-mono` na mesma linha de `tabular-nums`. Limite 0.
  - `borderAlpha`: valores distintos em `border-white/…`. Limite 0 (bordas vêm de `border-line` e `border-line-strong`).
  - `bgAlpha`: `bg-white/…` distintos. Limite 0.
  - `zinc`: `text-zinc-\d+`, `bg-zinc-\d+`. Limite 0.
  - `transitionUnsafe`: `transition` ou `animate-` sem `motion-safe:` na mesma classe. Limite 0.
  - `deadUi`: arquivos em `src/components/ui/*.tsx` não importados em lugar nenhum (fora de `index.ts`). Limite 0.
  - `emDash`: o travessão longo em `src/**` e `docs/**`. Limite 0.
  Cada medida aceita `LIMITS[name] = null` para "ainda não ativa", para a fase 1 ligar uma a uma.
- [ ] **Step 2: Rodar `npm run ds:check` com todos os limites `null`.** Esperado: imprime o inventário (contagens por regra) e sai 0.
- [ ] **Step 3: Rodar com `LIMITS.emDash = 0`.** Esperado: sai 0 (o código já não tem em dash) ou lista as linhas; corrigir as que listar.
- [ ] **Step 4: Commit** `chore: verificador ds-check dos critérios de pronto`.

### Task 2: Tokens em `globals.css`

**Files:**
- Modify: `src/app/globals.css` (substituir tudo entre `@custom-variant` e o fim)
- Modify: `src/app/layout.tsx:38` (`<html>` sem `dark`, com `className` só das fontes + `h-full antialiased`)
- Delete: `docs/Design_System_COB.md`

**Interfaces:**
- Produces: classes Tailwind `bg-bg`, `bg-surface-1/2/3`, `border-line`, `border-line-strong`, `text-fg`, `text-mute`, `text-dim`, `bg-accent`, `text-accent`, `text-accent-fg`, `bg-accent-soft`, `text-accent-text`, `text-good/warn/bad/none`, `bg-good/12` (via `color-mix` nativo do Tailwind v4), `text-gold`; `rounded-sm (8) / md (12) / card (16) / panel (20)`; `type-display/title/subtitle/body/caption/label/metric-lg/metric/metric-sm` como utilitários `@utility` que fixam tamanho, altura, peso e tracking de uma vez; `shadow-relief` (inset 1px) e `shadow-float`; `ease-out-std` e `ease-out-quint`; `font-mono` só via `--font-mono`.

- [ ] **Step 1: Escrever `@theme`** com os valores de §4.1, §4.3 e `--font-sans`/`--font-mono` apontando para as variáveis do next/font (manter o `@theme inline` só para as duas fontes). Declarar `:root { color-scheme: dark }`. Remover todos os tokens shadcn (`--primary`, `--sidebar-*`, `--chart-*`, oklch) e o bloco `.dark`. Manter `body { @apply bg-bg text-fg font-sans }` e trocar `* { outline-ring/50 }` por nada (foco vem dos primitivos).
- [ ] **Step 2: Escrever as `@utility`** de tipo (§4.2): por exemplo `@utility text-display { font-size: 2rem; line-height: 1.1; font-weight: 800; letter-spacing: -0.03em; @media (max-width: 640px) { font-size: 1.625rem } }`; as de métrica incluem `font-variant-numeric: tabular-nums`.
- [ ] **Step 3: Verificar:** `npm run build` passa; abrir `http://localhost:3010/placar` e confirmar que o fundo continua `#07080a`, que o seletor de mês das Notas abre escuro e que nada ficou branco (o `.dark` sumiu, então qualquer classe shadcn órfã aparece agora).
- [ ] **Step 4: Commit** `feat(ds): tokens de cor, tipo, forma e movimento no globals.css`.

### Task 3: Movimento global e `cn`

**Files:**
- Create: `src/lib/cn.ts`, `src/components/ui/motion.ts`
- Modify: `src/app/layout.tsx` (envolver `children` em `<MotionConfig reducedMotion="user">`; remover `TooltipProvider`)

**Interfaces:**
- Produces: `cn(...inputs: ClassValue[]): string` (clsx + tailwind-merge, com `extend` para as classes de tipo customizadas `text-display` etc. não serem mescladas como `text-*` de cor). `export const spring = { type: "spring", stiffness: 380, damping: 32 } as const; export const ease = { std: [0.32,0.72,0,1], quint: [0.22,1,0.36,1] } as const; export const dur = { fast: 0.12, base: 0.2, slow: 0.45 } as const;`

- [ ] **Step 1: Escrever `cn` e `motion.ts`** com os valores acima.
- [ ] **Step 2: Teste do `cn`:** `node --experimental-strip-types -e` ou um `scripts/cn-check.mjs` descartável: `cn("px-4", "px-0") === "px-0"` e `cn("text-display", "text-mute")` mantém os dois. Esperado: ambos verdadeiros.
- [ ] **Step 3: `MotionConfig` no layout.** Verificar no Chrome com "Emulate CSS prefers-reduced-motion: reduce" (DevTools Rendering) que o sublinhado da aba troca sem deslizar.
- [ ] **Step 4: Commit** `feat(ds): cn, tokens de movimento e MotionConfig`.

### Task 4: Primitivos de base (`Button`, `Field`, `Surface`, `Label`, `SectionTitle`, `Kbd`, `Pill`)

**Files:**
- Create: `src/components/ui/button.tsx` (substitui o shadcn), `field.tsx`, `surface.tsx`, `label.tsx`, `section-title.tsx`, `kbd.tsx`, `pill.tsx`, `index.ts`
- Delete: `src/components/ui/{avatar,badge,card,input,label,select,separator,tabs,tooltip,dropdown-menu,sheet}.tsx`

**Interfaces (props exatas, §5):**
- `Button({ variant?: "primary"|"ghost"|"soft"|"danger"|"link"; size?: "sm"|"md"|"lg"; pending?: boolean; icon?: LucideIcon; iconEnd?: LucideIcon; href?: string; ...button })`. Com `href` renderiza `Link`. `primary` + `iconEnd` desenha o ícone num círculo de 22px `bg-accent-fg/18`. `pending` mostra `Loader2` girando (`motion-safe:animate-spin`) no lugar do ícone e mantém `aria-busy`. Foco: `focus-visible:outline-2 outline-offset-2 outline-accent`. Tap: envolve em `motion.button whileTap={{scale:.98}}`.
- `Field({ label: string; hint?: string; error?: string; as?: "input"|"select"|"textarea"; id: string; ...props })`. Erro liga `aria-invalid` e `aria-describedby`.
- `Surface({ level?: 1|2; interactive?: boolean; glow?: boolean; as?: "div"|"section"|"article"|"li"; ...div })`.
- `Label({ tone?: "dim"|"accent"; children })` renderiza `<span class="text-label font-mono uppercase">`.
- `SectionTitle({ title: string; hint?: string; right?: ReactNode; id?: string })`.
- `Kbd({ children })`. `Pill({ tone?: Tone|"accent"|"neutral"; icon?: LucideIcon; children })`.
- `index.ts` reexporta tudo.

- [ ] **Step 1: Escrever os sete componentes** com `cn` e os tokens da Task 2. `button.tsx` novo não exporta `buttonVariants` (quem importava era só o `dialog.tsx`, tratado na Task 6).
- [ ] **Step 2: Rodar `npx tsc --noEmit`.** Esperado: erros só nos arquivos apagados que ainda são importados por `dialog.tsx` e `sonner.tsx` (listar; são resolvidos nas Tasks 6 e 7). Nenhum erro nos sete arquivos novos.
- [ ] **Step 3: Página de prova temporária** `src/app/_ds/page.tsx` com todas as variantes de `Button` (5 variantes × 3 tamanhos, `pending`, com `iconEnd`), `Field` nos 3 modos com erro, `Surface` 1/2/interactive/glow, `Label`, `SectionTitle`, `Pill` nos 6 tons. Abrir em `http://localhost:3010/_ds` e conferir no Chrome: foco visível com Tab em todos; `whileTap` afunda; erro do `Field` lido por `aria-describedby` (ver no painel Accessibility).
- [ ] **Step 4: Commit** `feat(ds): primitivos de base (Button, Field, Surface, Label, SectionTitle, Kbd, Pill)`.

### Task 5: Primitivos de dado (`Metric`, `Score`, `Trail`, `Bar`, `PlayerLevel`)

**Files:**
- Create: `src/components/ui/metric.tsx`, `score.tsx`, `trail.tsx`, `bar.tsx`, `player-level.tsx`
- Modify: `src/components/placar/tones.ts` (só `TONE_STYLE` com classes de token: `text-good`, `bg-good/12`, `border-good/35`, `bg-good` solid; apagar `fieldLabel`, `fieldInput`, `btn*`)
- Modify: `src/components/placar/semana/comum.tsx` (apagar `ScoreBadge`, `TrailDots`, `CountUp`; manter `useNow`, `closesAt`, `countdown`, `pct`, `plural`)

**Interfaces:**
- `Metric({ value: number|null; format?: (n:number)=>string; unit?: string; label: string; sub?: string; tone?: Tone; size?: "lg"|"md"; delta?: { value: number; label: string } })`. `null` mostra "s/n" em `text-dim`. Anima com `useMotionValue` + `animate(..., { duration: dur.slow, ease: ease.quint })` do valor anterior ao novo; na primeira pintura parte de 0. Nunca reinicia do zero em atualização.
- `Score({ value: number|null; tone: Tone; size?: 32|40|56; label?: string })`: SVG `viewBox 0 0 40 40`, raio 17, `stroke-width 3.5`, trilho `stroke-line`, arco `stroke-{tone}` com `stroke-dasharray` animado por `motion.circle` (`pathLength`), `stroke-linecap round`. `null`: arco `stroke-dasharray 2 4` em `stroke-none`, texto "s/n". Texto interno `text-metric-sm` (`56` usa `text-metric`). `label` vira `aria-label` ("nota 9,2, verde").
- `Trail({ tones: Tone[]; scores?: (number|null)[]; size?: "sm"|"md" })`: 8 barras, altura proporcional ao score (`null` = 25% em `bg-none`), cor pelo tom.
- `Bar({ value: number; max: number; tone?: Tone|"accent"; size?: "sm"|"md"; marker?: number; label?: string })`: trilho `bg-line`, enchimento animado `slow` na primeira pintura e interpolado depois; `marker` desenha um traço de 2px em `bg-fg/60` na posição `marker/max`. `role="progressbar"` com `aria-valuenow`.
- `PlayerLevel({ xp: number; level: { n:number; name:string; from:number; next:number|null }; size?: "sm"|"md"; gold?: boolean })`: nome + `Bar sm` de `xp - from` em `next - from`; `gold` quando `level.name === "Lenda"`.

- [ ] **Step 1: Escrever os cinco** usando `motion/react`, `useReducedMotion` para pintar o valor final sem animar.
- [ ] **Step 2: Teste de `Metric` com `null`** na página `_ds`: `value={null}` mostra "s/n", `value={6.8}` mostra "6,8" (usar `format` padrão `toLocaleString("pt-BR", { maximumFractionDigits: 1 })`). Trocar o valor por botão na página de prova e confirmar que desliza do antigo ao novo, não do zero.
- [ ] **Step 3: Teste de `Score`:** renderizar 42 `Score size={40}` numa lista na `_ds`, rolar com o painel Performance do Chrome gravando: nenhum frame acima de 16ms no scroll (se passar, trocar `motion.circle` por CSS `stroke-dashoffset` com `transition` em `motion-safe:`).
- [ ] **Step 4: `npx tsc --noEmit`:** erros restantes só nos consumidores de `ScoreBadge`/`TrailDots`/`CountUp`/`btn*`/`fieldInput` (as telas, Fase 2). Anotar a lista no commit.
- [ ] **Step 5: Commit** `feat(ds): primitivos de dado (Metric, Score, Trail, Bar, PlayerLevel)`.

### Task 6: `Modal`, `Empty`, `Notice`, `Skeleton`

**Files:**
- Create: `src/components/ui/modal.tsx` (sobre `@base-ui/react/dialog`, como o `dialog.tsx` atual), `empty.tsx`, `notice.tsx`, `skeleton.tsx` (substitui)
- Delete: `src/components/ui/dialog.tsx` depois que `PlacarDialogs.tsx` for migrado (Task 12); até lá o arquivo fica mas é marcado `// legado: sai na Task 12`.

**Interfaces:**
- `Modal({ open: boolean; onClose: () => void; title: string; size?: "sm"|"md"; children; footer?: ReactNode })`: overlay `bg-bg/80 backdrop-blur-sm`; painel `rounded-panel bg-surface-1 shadow-float`; `md` = 560px centrado; `sm` = 440px centrado em `sm:` e folha inferior (`rounded-t-panel`, `bottom-0`, com `pb-[calc(env(safe-area-inset-bottom)+16px)]`) abaixo de `sm:`. Entrada `spring` (y 16 → 0, opacity). Fecha no Esc e no clique fora. Botão fechar com `aria-label="Fechar"`. Foco preso e rolagem travada vêm do base-ui.
- `Empty({ title: string; text?: string; action?: ReactNode })`.
- `Notice({ tone: "info"|"warn"|"bad"; title?: string; children; action?: ReactNode })`: `info` = `bg-accent-soft text-mute`; `warn` e `bad` = tom/12 com borda tom/35 e `role="status"` (`bad` = `role="alert"`).
- `Skeleton({ lines?: number; shape?: "text"|"metric"|"row"|"ring"; className? })`: `bg-surface-2` com brilho `motion-safe:animate-pulse`.

- [ ] **Step 1: Escrever os quatro.**
- [ ] **Step 2: Teste do `Modal` na `_ds`:** abrir, Tab não sai do modal, Esc fecha, a 390px (iframe de mesma origem) o `sm` vira folha colada embaixo. DevTools: `body` com rolagem travada enquanto aberto.
- [ ] **Step 3: Commit** `feat(ds): Modal, Empty, Notice, Skeleton`.

### Task 7: `Toast` e limpeza de dependências

**Files:**
- Modify: `src/components/ui/sonner.tsx` (sem `next-themes`: `theme="dark"`, `position="bottom-center"`, `offset` 24px e `mobileOffset` 80px, `toastOptions.classNames` pelos tokens, `richColors` desligado)
- Modify: `package.json` (`npm uninstall gsap recharts next-themes class-variance-authority` se `grep -r` não achar uso)

- [ ] **Step 1: Reescrever `sonner.tsx`** e disparar `toast.success("Lançado")` da `_ds`; conferir posição acima da barra inferior a 390px.
- [ ] **Step 2: `grep -rn "gsap\|recharts\|next-themes\|class-variance-authority" src` vazio → `npm uninstall` dos quatro.** Rodar `npm run build`. Esperado: passa.
- [ ] **Step 3: Commit** `chore(ds): toast único pelos tokens; remove gsap, recharts, next-themes, cva`.

### Task 8: `PageHeader` e contêiner único

**Files:**
- Create: `src/components/placar/PageHeader.tsx`
- Modify: `src/components/placar/PlacarBoard.tsx:156-215`, `SemanaBoard.tsx:201-250` (usar `PageHeader`), `src/app/page.tsx:15-18`, `src/app/financeiro/notas/page.tsx:276`, os três `entrar/page.tsx` (contêiner de §4.4)

**Interfaces:**
- `PageHeader({ eyebrow: string; title: string; week?: { label: string; hint: string; onPrev: () => void; onNext: () => void; nextDisabled?: boolean }; actions?: ReactNode })`. Setas com `ChevronLeft`/`ChevronRight` em `Button ghost size="sm"` quadrados (prop `icon` sem children → `aspect-square px-0`, resolvido pelo `cn`).
- Contêiner: constante `export const CONTAINER = "mx-auto w-full max-w-[1280px] px-4 pt-8 pb-24 sm:px-6 lg:px-10"` em `src/components/ui/index.ts`.

- [ ] **Step 1: Escrever `PageHeader`** e aplicar nas duas boards. Aplicar `CONTAINER` nas cinco páginas; `scroll-mt-20` nas âncoras da home.
- [ ] **Step 2: Verificar alinhamento:** no Chrome a 1440px, `getBoundingClientRect().left` do logo no HUD e do `h1` em `/`, `/placar`, `/placar/semana`, `/financeiro/notas` são iguais (40px).
- [ ] **Step 3: `npx tsc --noEmit` e `npm run lint`** passam (as boards ainda usam `btn*` etc.? Não: `tones.ts` já perdeu os `btn*` na Task 5, então aqui as duas boards trocam `btnPrimary/btnGhost` por `Button` e `fieldInput` por `Field` nos pontos que sobrarem; esta é a passada "ligar por baixo sem mudar desenho" de §11 fase 1).
- [ ] **Step 4: `npm run ds:check` com `LIMITS.deadUi = 0`, `emDash = 0`** passa. Apagar `src/app/_ds` ou mantê-la? Manter, atrás do gate (já é protegida pelo proxy) como styleguide vivo: renomear para `src/app/ds/page.tsx` e listar em `destinos.ts` só para admin.
- [ ] **Step 5: Commit** `refactor(ds): PageHeader, contêiner único e primitivos ligados por baixo das telas`.

### Task 9: Fim da fase 1 (prova)

- [ ] **Step 1:** `npm run build`, abrir as 7 telas a 1440 e 390 no Chrome real com a sessão de teste; console limpo; nada visualmente quebrado em relação à produção (só ligações por baixo).
- [ ] **Step 2:** `npm run ds:check` com `hex`, `pxText`, `monoNumber`, `borderAlpha`, `bgAlpha`, `zinc`, `transitionUnsafe` ainda `null`, imprimindo o inventário: anotar os números no commit para a fase 2 zerar.
- [ ] **Step 3: Commit** `chore(ds): fase 1 fechada; inventário para a fase 2`. Backup `~/Projects/_backups/cob-hub-2026-10-28-premium-f1` (rsync sem node_modules/.next/.env).

---

## Fase 2: Telas (uma por commit; cada uma zera o `ds-check` nos seus arquivos)

### Task 10: HUD, cartão do jogador e menu rápido (§6.1)

**Files:**
- Create: `src/components/hud/PlayerCard.tsx`
- Modify: `Hud.tsx`, `MenuRapido.tsx`, `DestinoIcon.tsx`, `usePlayer.ts`
- Modify: `src/lib/placar/jogador.ts`, `src/app/api/placar/eu/route.ts` (campo `team`)

**Interfaces:**
- `jogador()` passa a devolver também `team: { green: number; total: number; goalPct: 70 }`, calculado do store com a mesma função de tom usada pelo `semanaSnapshot` (importar `toneGetter`/`byClient` de `jogo.ts`; sem ClickUp).
- `usePlayer()` passa a devolver `{ data, error: string|null, retry: () => void }`.

- [ ] **Step 1: `team` no `jogador.ts` e na rota.** Verificar com `curl -b <cookie> localhost:3010/api/placar/eu | jq .team` → `{ green, total, goalPct: 70 }`.
- [ ] **Step 2: HUD pelos tokens:** `bg-surface-1/92`, `border-line`, abas em `text-body font-medium`, sublinhado `layoutId` também na barra inferior (mesmo `layoutId="aba-acesa"` só existe uma vez por viewport: a barra inferior usa `"aba-acesa-mobile"`). `PlayerCard` com avatar, nome em `text-caption font-semibold`, `PlayerLevel size="sm"`.
- [ ] **Step 3: Estado de falha:** simular `/api/placar/eu` com 500 (bloquear a URL no DevTools Network) → chip mostra nome sem nível; menu mostra `Notice bad` "Não deu para ler seu cartão" com `Button link` "tentar de novo" que chama `retry()`. Nenhum "…".
- [ ] **Step 4: `MenuRapido`** com `rounded-panel bg-surface-1 shadow-float`, overlay igual ao `Modal`, item ativo `bg-surface-2 border-line-strong`, `DestinoIcon` com `strokeWidth 1.75`, `Kbd` único.
- [ ] **Step 5: `ds-check` nos arquivos de `hud/`** zera `hex`, `pxText`, `zinc`, `borderAlpha`, `bgAlpha`, `transitionUnsafe` (rodar o script com `--only src/components/hud`).
- [ ] **Step 6: Commit** `feat(hud): pele Arena, cartão do jogador, falha com saída`.

### Task 11: Início como tela de partida (§6.2)

**Files:**
- Modify: `src/app/page.tsx`, `src/components/hud/Continuar.tsx`, `src/components/Tile.tsx`, `src/components/ShelfRow.tsx`

- [ ] **Step 1: Remover** o hero (h1 de landing, parágrafo, `kbd` de dica) e o watermark de letra em `Tile.tsx:20,37` e `page.tsx` (o `mark` continua no `catalog.ts` para o `DestinoIcon`).
- [ ] **Step 2: Saudação:** `text-title` "Bom dia / Boa tarde / Boa noite, {nome}" (sem login: "Olá"), `text-caption text-mute` com data por extenso em pt-BR e "rodada N de 14".
- [ ] **Step 3: Cartão da rodada (gesto-herói):** `Surface glow` com `Score size={56}` em modo percentual (`value = round(green/total*10*10)/10`? Não: `Score` recebe 0-10; aqui passar `value={green/total*10}` e `label="N de M no verde"`), missões, "fecha em", `Button primary iconEnd={Play}` "Continuar a rodada", `Button ghost` "Lançar números" (`href="/placar"`). Sem login: mesmo `Surface` com `Button primary href="/placar/entrar?next=%2Fplacar%2Fsemana"`.
- [ ] **Step 4: `Tile`** = `Surface interactive` com nome `text-subtitle`, descrição `text-body text-mute`, rodapé `text-caption font-mono text-dim` + `Kbd` + `ArrowUpRight` 16px; nota em `Pill warn`. Hover só sob `@media (hover:hover)` (`hover:` do Tailwind v4 já faz isso por padrão; confirmar na build).
- [ ] **Step 5: Verificar** a 1440 e 390: primeiro quadro mostra saudação + cartão + primeira prateleira; teclas 1-9 continuam abrindo; nada rola na horizontal.
- [ ] **Step 6: `ds-check --only src/app/page.tsx src/components/Tile.tsx src/components/ShelfRow.tsx src/components/hud/Continuar.tsx`** zera. Commit `feat(home): tela de partida com cartão da rodada`.

### Task 12: Placar de Clientes (§6.3)

**Files:**
- Modify: `src/components/placar/PlacarBoard.tsx`, `PlacarDialogs.tsx`
- Delete: `src/components/ui/dialog.tsx`

- [ ] **Step 1: KPIs** = 4 `Metric size="lg"` em `Surface` (grid 2 colunas até `md`, 4 depois); modo finance mantém os 4 KPIs em R$ com `format` de moeda. "Nota média" sem leitura = `value={null}` + `sub="0 de 42 com nota"`.
- [ ] **Step 2: Distribuição** = `Bar md` segmentada: implementar como 4 `motion.div` lado a lado dentro do trilho (largura = fração, cor = tom), legenda em 4 `Pill` com contagem (e R$ no modo finance).
- [ ] **Step 3: Filtro de donos** = chips com `Score 32` + nome + contagem; selecionado `bg-surface-2 border-line-strong` (apagar o `shadow-[inset…]`).
- [ ] **Step 4: Lista** = `ul` com `AnimatePresence` + `motion.li layout` por cliente (`key = client.id`), cada um `Surface interactive` de até 64px, gap 6px: `Score 40` | nome `text-subtitle` + dono/escopo `text-caption text-mute` | meta `text-body` | resultado `text-body tabular` | `Trail` | ação. Ação: `Button primary size="sm"` "Lançar" só quando `!hasEntryThisWeek`; senão `Pill good` "Lançado" + `Button ghost size="sm"` "Editar". Linha `bad`: `before:` de 2px `bg-bad` dentro do raio (`overflow-hidden`).
- [ ] **Step 5: Folha da nota:** clicar no `Score` abre `Modal sm` com a conta (o conteúdo do `title` atual de `PlacarBoard.tsx:559`), no desktop e no toque.
- [ ] **Step 6: Estados:** `Skeleton shape="metric"` ×4 + `shape="row"` ×6 enquanto `!data`; `Empty` "Cadastre o primeiro cliente" com `Button primary`; `Notice bad` com "tentar de novo"; `text-caption text-dim` "atualizando…" ao lado do período durante o poll (estado `refreshing`).
- [ ] **Step 7: Diálogos** em `Modal` + `Field` + `Button pending`; campo da nota do cliente com `inputMode="decimal"`; apagar duplo clique de confirmação e usar `Modal sm` "Apagar {nome}?" com `Button danger`. Apagar `ui/dialog.tsx`.
- [ ] **Step 8: Review Focus 1:** abrir o modal de lançar num cliente, esperar o poll de 30s (ou forçar `router.refresh`): o modal continua aberto com o mesmo cliente e a lista reordena atrás sem salto.
- [ ] **Step 9: Verificar** 1440 (≥ 12 linhas visíveis a 900px de altura) e 390; `/financeiro/placar` com valores; `ds-check --only src/components/placar/PlacarBoard.tsx src/components/placar/PlacarDialogs.tsx` zera. Commit `feat(placar): anel, lista animada, estados e modal único`.

### Task 13: Rodada da semana (§6.4)

**Files:**
- Modify: `SemanaBoard.tsx`, `semana/Temporada.tsx`, `semana/Missoes.tsx`, `semana/Revelacao.tsx`, `semana/comum.tsx`

- [ ] **Step 1: Trilha** = 14 `Bar sm` (fechada `accent`, atual `motion-safe:animate-pulse`, futura `bg-line`); clique numa rodada abre `Modal sm` com as datas (substitui o `title`).
- [ ] **Step 2: Gesto-herói** = um `Surface glow` com `Score 56` percentual da meta (`value = green/total*10`, `label` "N de M no verde, meta 70%"), `text-title` "faltam N clientes no verde", e o pódio à direita: 3 `motion.div` com altura proporcional ao XP (`scaleY` com `spring`, stagger 0.12), 1º com `border-t-2 border-gold`. Remover o `Surface` separado do pódio.
- [ ] **Step 3: Tabela da temporada** = linhas `Surface` com `PlayerLevel size="md"` (`gold` no Lenda), XP em `text-metric-sm`, selos como ícones 18px `text-mute` (desbloqueado `text-fg`); selecionado `bg-surface-2 border-line-strong`.
- [ ] **Step 4: Missões** = grid de 3 colunas em que `kind === "virada"` ocupa `md:col-span-2` com `Score 40` do cliente, conta do que falta e `Bar sm bad`; as demais 1 coluna; 6 visíveis + "Ver todas"; cumprida = `Pill good` "cumprida". Toast de missão cumprida vira `toast.success` do sonner com o confete por cima (apagar o toast próprio de `SemanaBoard.tsx:377-383`).
- [ ] **Step 5: Vermelhos** = lista `Surface` com `Score 40`, `Button link iconEnd={ArrowUpRight}` para a tarefa, prazo em `Pill` (`warn` < 24h, `bad` vencido). Mapa = grid de `Score 40` + `text-caption`; clique abre `ClientSheet` migrado para `Modal sm`.
- [ ] **Step 6: Seções** com `SectionTitle`; apagar `border-t` e caixas de seção; gap 40px entre blocos. Erro de leitura em `Notice bad`; resultado de ação em `toast`.
- [ ] **Step 7: Revelação** com `text-display`, `Metric lg`, pódio do gesto; `Button link` "Rever a revelação" no rodapé. Review Focus 5: com reduced motion a revelação pinta tudo de uma vez e o confete não roda.
- [ ] **Step 8: Verificar** com os dados de teste de rodada (`$S/placar-local-rodada-test.json` via `PLACAR_FILE`) a 1440 e 390; `ds-check --only src/components/placar/SemanaBoard.tsx src/components/placar/semana` zera. Commit `feat(rodada): gesto da meta e pódio, missão de virada maior, estados`.

### Task 14: Notas do mês (§6.5)

**Files:**
- Create: `src/app/financeiro/notas/loading.tsx`, `error.tsx`
- Modify: `src/app/financeiro/notas/page.tsx`

- [ ] **Step 1:** `PageHeader` + `CONTAINER`; faixa de sandbox em `Notice info`; competência em `Field as="select"` + `Button ghost` "Ver"; pendências em `Notice warn`, falha em `Notice bad`; tabela com `th` em `text-label`, linhas `border-line`, valores `tabular-nums`, status em `Pill`; botões com `pending` via `useFormStatus` (componente cliente `SubmitButton`).
- [ ] **Step 2: Cancelar nota** abre `Modal sm` "Cancelar a nota {numero} de {valor}?" com `Button danger pending`; só o confirmar chama a action. Barra de ação fixa `bottom-[calc(56px+12px)] sm:bottom-6 z-30`.
- [ ] **Step 3: `loading.tsx`** com `Skeleton` (cabeçalho + 4 linhas); `error.tsx` com `Notice bad` + `Button ghost` "tentar de novo" (`reset()`).
- [ ] **Step 4: Verificar** a 390: barra de ação acima da barra inferior; `ds-check --only src/app/financeiro/notas` zera. Commit `feat(notas): mesmo sistema, loading, erro e confirmação de cancelamento`.

### Task 15: Login (§6.6)

**Files:**
- Create: `src/components/LoginCard.tsx`
- Modify: os três `entrar/page.tsx`

**Interfaces:** `LoginCard({ title: string; text: string; fields: ("name"|"password")[]; action: string; next?: string; error?: string })` renderiza `Surface` de 400px com `Logo`, `text-title`, `text-body text-mute`, `Field`s, `Button primary size="lg" pending` (cliente, `useFormStatus`), `Notice bad` com `aria-describedby` no campo.

- [ ] **Step 1: Escrever e aplicar.** Verificar os três fluxos de login com as senhas de teste locais; `ds-check --only src/app/entrar src/app/placar/entrar src/app/financeiro/entrar src/components/LoginCard.tsx` zera.
- [ ] **Step 2: Commit** `feat(login): um LoginCard para os três acessos`.

---

## Fase 3: Toque

### Task 16: Celular e colisões (§8)

- [ ] **Step 1:** `grep -rn 'title=' src/components src/app` → cada `title` informativo vira `Modal sm` ou texto visível (Placar nota: feito na Task 12; trilha: Task 13; sequências em `Missoes.tsx:223,229`: `Pill` com "N verdes seguidos"; `Tile.tsx:40` e `page.tsx:56`: remover).
- [ ] **Step 2:** alvos de toque: toda linha clicável e botão `sm` com `min-h-[44px]` abaixo de `sm:` (o `Button sm` = 32px no desktop, 44 no celular).
- [ ] **Step 3: Verificar** a 390: Notas, toast, folha e menu rápido acima da barra inferior; `document.documentElement.scrollWidth === 390` em todas as telas.
- [ ] **Step 4: Commit** `fix(mobile): dicas viram folha, alvos de 44px, nada atrás da barra`.

### Task 17: Foco e contraste (§9)

- [ ] **Step 1:** `grep -rn 'focus-visible' src` cobre todos os `button`, `a`, `Link` e elementos com `onClick`; remover `outline-none` em `Tile` e podium.
- [ ] **Step 2:** `ds-check` com `LIMITS.zinc = 0` em todo `src` (texto só `text-fg/mute/dim`). Conferir no axe (cdnjs, Chrome real) que não há contraste abaixo de 4,5:1 em texto.
- [ ] **Step 3: Commit** `fix(a11y): foco único e contraste mínimo`.

---

## Fase 4: Prova e entrega

### Task 18: Prova completa

- [ ] **Step 1:** `npx tsc --noEmit && npm run lint && npm run build` passam. `npm run ds:check` com **todos** os limites ativos passa.
- [ ] **Step 2:** Chrome real, 1440 e 390, as 7 telas logado como admin e como não-admin (sessão de teste de outra pessoa): console limpo, sem rolagem horizontal.
- [ ] **Step 3:** axe via cdnjs nas 7 telas: 0 sério/crítico.
- [ ] **Step 4:** Régua anti-IA (`~/Projects/cob-ds/playbook-anti-ia.md`) por tela, nota ≤ 3, anotada em `docs/design-system.md` §10.
- [ ] **Step 5:** Backup `~/Projects/_backups/cob-hub-2026-10-28-premium`. Commit `chore: prova da fase 4`. Relatório ao Matheus com prints e pedido de OK para o deploy (comparação de produção antes e depois no momento do deploy, conforme `feedback_deploy_colisao_sessoes`).
