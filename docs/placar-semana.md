# Rodada da semana (gamificação do Placar) e tarefas dos vermelhos

Decidido com o Matheus em 27/10/2026. Este documento é a fonte da verdade; o código segue o que está aqui.

## Para que serve

Abrir a reunião de segunda com o placar do time e transformar cliente vermelho em tarefa com dono e prazo.
O foco de 2027 é cliente batendo meta para gerar indicação e aumento de contrato. Os pontos premiam isso,
nunca punem: não existe ponto negativo.

## A rodada

- Cada semana (segunda a domingo) é uma rodada.
- A rodada da semana W fecha na segunda seguinte às 10h, o prazo de lançamento. O fechamento roda sozinho
  (Vercel Cron, entre 10h e 11h) e o Matheus tem um botão "Fechar rodada agora" para o caso de falha.
- No fechamento, a nota de cada cliente ativo é congelada na tabela `placar_rodada`. Lançamento atrasado
  ou meta trocada depois não muda rodada fechada. Desde 04/11/2026 o degrau do benchmark também é congelado (`tier`).
- Antes de fechar, a tela mostra a rodada como prévia, com os números do momento.

## Pontos por cliente (vão para o dono do cliente)

| O que | Pontos |
|---|---|
| Cliente com leitura (tem meta e número, não está cinza) | +1 |
| Cliente no verde (nota 7 ou mais) | +2 |
| Virada: estava vermelho na rodada anterior e agora está amarelo ou verde | +5 |
| Sequência: completou 4, 8, 12... rodadas seguidas no verde. Ganha o selo "pronto para indicação" | +5 |
| Degrau: subiu de degrau na escada do benchmark em relação à última rodada fechada com degrau (docs/placar-benchmark.md) | +3 |

- Ranking dos donos pela média de pontos por cliente ativo da carteira (empate: total de pontos).
  Assim quem tem 20 clientes não ganha só pelo tamanho.
- Meta do time: % da carteira ativa no verde. Alvo: 70% em janeiro.
- Clientes sem dono contam para a meta do time, mas não entram no ranking.

## Camada de jogo (pedida pelo Matheus em 27/10/2026: "tudo gameficado, interativo")

Tudo continua saindo do resultado do cliente. O jogo só dá forma ao que os pontos já medem.

### Temporada

- Temporada 1 = 12 rodadas, da semana de 09/11/2026 à semana de 25/01/2027 (fecha em 01/02/2027).
- A tela mostra "Rodada N de 12" e a trilha da temporada (rodadas fechadas acesas).
- Zerado em 09/11/2026 a pedido do Matheus: as rodadas de 26/10 e 02/11 foram aquecimento e saíram da conta (linhas apagadas de `placar_rodada`, cópia em `~/Projects/_backups/placar-dados-2026-11-09`). Lançamentos, metas e curvas ficaram. Semana anterior a 09/11 não fecha mais (`closeWeek` devolve sem gravar). O que acumula recomeça do zero: pontos, XP, nível, conquistas, sequência no verde (só conta rodada da temporada, então o primeiro selo possível é na rodada 4). O que compara esta semana com a passada segue valendo: virada usa a cor real da semana anterior, subir de degrau compara com o degrau lido na semana anterior quando não há rodada congelada (rodada 1 ou cliente novo), e vermelho há 4 semanas continua escalando a tarefa.

### XP e nível (por dono)

- XP da rodada = média de pontos por cliente × 10, arredondado. É o mesmo número do ranking, sem vírgula.
- XP da temporada = soma do XP das rodadas fechadas da temporada. Prévia não soma.
- Tabela da temporada ordenada pelo XP da temporada.
- Níveis pelo XP da temporada: Estreante (0), Titular (60), Destaque (150), Craque (270), Lenda (400).

### Conquistas (por dono, valem a temporada toda, só rodada fechada)

| Conquista | Como destrava |
|---|---|
| Virada | virar um cliente do vermelho |
| Hat-trick | 3 viradas na temporada |
| Pronto para indicação | um cliente com 4 rodadas seguidas no verde |
| Carteira lida | uma rodada com todos os clientes com leitura (nenhum cinza) |
| Zero vermelho | uma rodada com todos com leitura e nenhum vermelho |
| Tudo verde | uma rodada com a carteira inteira no verde |
| Líder da rodada | 1º lugar numa rodada fechada |
| Plano em 72h | fechar no ClickUp uma tarefa de recuperação em até 72h depois de criada |
| Degrau acima | subir um cliente de degrau na escada do benchmark (04/11/2026) |
| Ouro | fechar uma rodada com um cliente em Ouro (04/11/2026) |

Conquista não dá ponto. Ela marca o caminho.

### Missões da semana (semana em andamento, ao vivo)

Para cada cliente, a tela diz o que fazer nesta semana e quanto vale:

| Missão | Quando aparece | Vale |
|---|---|---|
| Virar | estava vermelho na rodada anterior | +5 (e +1 de leitura) |
| Selo | 3, 7, 11... rodadas seguidas no verde | +5 (e +2 do verde) |
| Chegar no verde | amarelo agora | +2 |
| Tirar do cinza | sem leitura (falta número, meta ou marco) | +1 |

- A missão mostra o número que falta lançar na semana para chegar lá ("lançar 12 leads"). A conta é a
  própria régua do placar simulando o lançamento, nunca uma conta paralela.
- Se a nota do cliente (avaliação dele) segura a nota, a missão avisa que o número sozinho não resolve.
- Cliente de mídia com escada: a missão traz uma segunda linha com o degrau de agora e o que falta para o próximo
  ("subir para Prata: custo precisa cair de R$ 18,40 para R$ 7,53"), valendo +3 (04/11/2026).
- Missão cumprida aparece marcada quando a nota ao vivo chega no alvo.
- Por dono, a tela mostra quantos clientes já têm o número da semana lançado.

### Interação

- Filtro por pessoa (abre no próprio usuário quando ele é dono de cliente).
- Mapa da carteira: um quadrado por cliente na cor da nota; clicar abre o histórico das últimas 8 rodadas,
  pontos, missão e tarefa.
- Revelação da rodada: a primeira vez que alguém abre uma rodada fechada (por navegador), toca a revelação
  com pódio, viradas e selos. Botão "Rever a revelação" para a reunião. Fechar na mão também toca.
- Animações respeitam "reduzir movimento" do sistema.

### Na tarefa do ClickUp

A tarefa do vermelho diz quanto falta lançar para virar e o que vale: virada +5 e a conquista Plano em 72h.

## Tarefas dos clientes vermelhos no ClickUp

- Lista central "🔴 Clientes no vermelho", na pasta Gestão – Score & Rituais (space Operação – Tráfego).
- No fechamento da rodada, cada cliente vermelho sem tarefa aberta ganha uma:
  "🔴 Plano de recuperação: <cliente>", responsável = dono do cliente (sem dono vai para o Matheus),
  prazo de 72h, checklist adaptado do SOP de Conta Vermelha (72h) da Sayuri.
- Cliente 4 rodadas fechadas seguidas em Abaixo na escada do benchmark (e não vermelho): tarefa
  "🟠 Plano de degrau: <cliente>", mesma lista, 72h, com o que falta para Bronze (04/11/2026, docs/placar-benchmark.md).
- Cliente vermelho em 4 rodadas seguidas: a tarefa aberta é escalada uma vez (comentário, prioridade
  urgente e o Matheus como responsável) para a reunião decidir escopo, dono ou encerrar.
- Botão "Criar tarefa" na tela da rodada para quem ficou vermelho no meio da semana.
- Fechar a tarefa não tira o cliente do vermelho. Quem tira é o número no placar.
- O status das tarefas é lido do ClickUp numa chamada só (a lista inteira), no máximo a cada 10 minutos.
- A tabela `placar_tasks` guarda qual tarefa é de qual cliente, para nunca criar duas abertas, e quando
  ela fechou (`closed_at`, para a conquista Plano em 72h).

## Configuração

| Variável | Para quê |
|---|---|
| `CLICKUP_TOKEN` | Token do ClickUp (o mesmo `pk_44275261_…` dos outros sistemas). Sem ele, nada é criado e a tela avisa. |
| `CLICKUP_RED_LIST_ID` | Id da lista "🔴 Clientes no vermelho". |
| `CRON_SECRET` | A Vercel manda no cabeçalho do cron; sem ele o fechamento automático recusa. |
| `PLACAR_TASK_PREFIX` | Só para teste: prefixo no nome da tarefa (ex.: `[TESTE] `). |

Tabelas: `supabase/placar-rodada.sql` (idempotente, mesmo padrão de acesso de `placar.sql`).

## Semana padrão da tela

Sem `?week=`, a tela e a API abrem em `defaultRodadaWeek()` (`rodada-rules.ts`): a última semana terminada, ou a 1ª rodada da temporada enquanto nenhuma fechou. Antes disso a tela abria na semana anterior à temporada e dizia "fora da temporada" (corrigido em 01/11/2026).
