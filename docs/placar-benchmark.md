# Benchmark e escada de degraus do Placar

Decidido com o Matheus em 04/11/2026. Este documento é a fonte da verdade; o código segue o que está aqui.

## Por que existe

A meta de volume ("135 contatos no mês") depende da verba do cliente e por isso precisava de reunião com ele.
A COB quer meta interna, medida, por setor, que mova a empresa sem depender dessa reunião. A régua passa a
ser o **custo por resultado** (ou o retorno, no e-commerce), que não depende de verba, comparado com o mercado.

## Grupo e tipo de resultado

Todo cliente de mídia tem dois rótulos em `placar_clients`:

| Campo | Valores | Para quê |
|---|---|---|
| `sector` | `escola-idiomas`, `clinica`, `veicular`, `servico-local`, `imobiliaria`, `ecommerce`, `b2b`, `industria`, `eventos`, `turismo`, `educacao`, `social` (sem mídia) | Com quem o cliente é comparado |
| `result_kind` | `lead` (formulário ou conversão), `conversa` (mensagem no WhatsApp ou Direct), `venda` (reais vendidos), vazio (sem mídia) | Custo de conversa e custo de lead são ordens diferentes; nunca se comparam |

O eixo principal é o tipo de resultado; o setor é o segundo. Grupo = `sector` + `result_kind`.

`ads_meta` e `ads_google` guardam o id da conta de anúncio de cada cliente (a leitura automática usa isso).

## Custo por resultado (a nova leitura)

Cada lançamento (`placar_entries`) passa a ter `spend` (gasto Meta + Google na janela do lançamento) e
`detail` (gasto e resultado por plataforma, para separar Meta de Google).

Para o cliente na semana W, sobre a mesma janela de 4 semanas da nota:

- `lead` e `conversa`: custo = soma do gasto ÷ soma dos resultados.
- `venda`: retorno = soma das vendas ÷ soma do gasto (ROAS).
- Sem gasto ou sem resultado na janela: sem leitura de degrau (o cliente continua com nota normal).

## As referências

Tabela `placar_benchmarks`, uma linha por grupo e plataforma, com a curva p25 / p50 / p75 / p90:

| Plataforma | De onde vem | Atualiza |
|---|---|---|
| `meta` | Coorte da própria Meta (anunciantes do mesmo setor e objetivo), lida pelo conector de Meta Ads do Claude. Só existe para as contas que a Meta já liberou (04/11: The Joy Matriz, Santana, Vila Prudente e Cave Antiga). | Rotina mensal "Curva da Meta para o placar" (claude.ai/code/routines, dia 1 às 8h BRT, conector Meta-ADS) que grava em `POST /api/placar/benchmarks` com o `BENCHMARK_TOKEN` (Vercel). A linha guarda a data da leitura. |
| `google` | A Google não publica coorte por API. A referência é a própria carteira COB no Google (quartis do grupo) até existir fonte melhor | Calculada ao vivo |
| `cob` | Quartis da carteira COB no grupo, últimas 12 semanas, só clientes com gasto e resultado | Calculada ao vivo, nunca gravada |

Estudos públicos (WordStream/LocaliQ 2025, blogs brasileiros) entram só como faixa de sanidade no Modelo de
Gestão. Divergem demais entre si para virar meta.

Nenhum degrau pode ficar acima do teto econômico do cliente (CPL máximo = CPA máximo × taxa de fechamento,
regra da skill google-ads-cob). Quando o teto é menor que o degrau, o teto manda e a nota fica em "a revisar".

## A escada

| Degrau | Custo (lead, conversa) | Retorno (venda) |
|---|---|---|
| Ouro | ≤ p25 do mercado | ≥ p75 do mercado |
| Prata | ≤ p50 do mercado | ≥ p50 do mercado |
| Bronze | ≤ mediana da COB no grupo | ≥ mediana da COB no grupo |
| Abaixo | o resto | o resto |

- Mercado = linha `meta` do grupo quando existe; senão, a curva da COB no grupo faz as vezes (Prata = p25 da COB,
  Ouro = "a medir").
- Grupo com menos de 3 clientes com leitura: a curva da COB geral do mesmo tipo de resultado (todos os setores) faz as
  vezes da curva do grupo, marcada "COB geral" na tela. Sem leitura nenhuma, "a medir".
- Cliente novo entra em Bronze no dia 1, com a meta de volume = verba prevista ÷ mediana do grupo.
- **Meta automática** (04/11): cliente com `meta_auto` e `budget` (verba mensal prevista, Meta + Google) tem a meta
  de volume recalculada todo dia 1 (`/api/placar/cron/metas`, Vercel Cron 09h BRT): verba ÷ custo-alvo do próximo
  degrau acima do atual (venda: verba × retorno-alvo). Quem está em Ouro mira o próprio Ouro. A nota de meta diz a
  conta feita e a data; `meta_review` volta a falso. `?dry=1` só calcula.
- **Piso da meta automática** (11/11, pedido do Matheus: "metas desafiadoras, coerentes e de empresa séria"): a meta
  nunca fica abaixo do que o cliente já faz com a verba, mais 10% (verba ÷ custo atual × 1,1; venda: verba × retorno
  atual × 1,1). Antes, quem já custava menos que o Ouro ganhava meta pelo custo do Ouro e batia a meta sem esforço
  (Expresso Placas: meta 240 com 878 contatos no mês). A nota de meta diz "já faz R$ 4,65, meta 10% acima".
  E um teto: a meta sobe no máximo 50% sobre o que o cliente faz hoje com a verba, um degrau de cada vez
  (BeeMon a R$ 161 por lead viraria meta 14x maior mirando Bronze). Sem leitura ainda, vale só a régua do degrau.
- Meta manual acima da régua é mantida como está, com `meta_auto` desligado, para a régua não baixar meta que o
  dono assumiu com o cliente (Cave Antiga R$ 12.500, Brisa loja R$ 18.000).
- A escada recalcula a cada trimestre junto com os Rocks. No meio do trimestre a referência não muda.
- A meta do trimestre de cada cliente é **subir um degrau**. Quem está em Ouro é cobrado em volume.

## No jogo

- O fechamento da rodada grava o degrau do cliente em `placar_rodada.tier` (`ouro`, `prata`, `bronze`, `abaixo`, vazio).
- **Subiu de degrau** em relação à última rodada fechada em que tinha degrau: +3 pontos para o dono.
- Conquistas: **Degrau acima** (subir um cliente de degrau) e **Ouro** (fechar uma rodada com um cliente em Ouro).
- Missão da semana: "subir para Prata: custo precisa cair de R$ 18 para R$ 6". A conta usa a mesma régua.
- Meta do time no trimestre: carteira com leitura de degrau e nenhum cliente em Abaixo por 4 rodadas.
- **Gatilho** (04/11): cliente em Abaixo por 4 rodadas fechadas seguidas, e que não está vermelho (o vermelho já tem a
  sua), ganha no fechamento a tarefa "🟠 Plano de degrau: <cliente>" na mesma lista do ClickUp, dono = dono do
  cliente, 72h, com o que falta para Bronze e um plano de custo. Uma aberta por cliente (`placar_tasks`).

## Leitura automática (o sistema se move sozinho)

- Função `placar-pull` no projeto Supabase do iHub (mesmo banco do placar), agendada toda segunda às 09h BRT
  (12h UTC), antes do fechamento das 10h.
- Para cada cliente ativo com `ads_meta` ou `ads_google`, lê a semana anterior (segunda a domingo) pela API
  direta (`_shared/ads-direct`), soma por `result_kind` e grava `placar_entries` `<cliente>_<semana>` com
  `weeks = 1`, `value`, `spend`, `detail` e `source = 'auto'`.
- `conversa` soma `onsite_conversion.messaging_conversation_started_7d`; `lead` soma `lead` + `offsite_conversion.fb_pixel_lead`
  do Meta e `conversions` do Google; `venda` soma `action_values_purchase` do Meta e `conversions_value` do Google.
- Lançamento feito à mão (`source = 'manual'`) nunca é sobrescrito pela leitura automática.
- Conta sem permissão ou com erro não grava nada e fica listada no retorno da função (nota no cliente).

## Na tela

- Placar: coluna "custo" (R$ por resultado ou retorno em x) com o chip do degrau ao lado da nota.
- Ficha do cliente: régua do mercado com p25, p50, p75 e o marcador da COB; "falta R$ X para o próximo degrau".
- Rodada: KPI "degraus subidos na rodada" e as duas conquistas.
- Início: "clientes em Prata ou Ouro" na carteira.
