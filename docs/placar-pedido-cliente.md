# Pedido do cliente: o resultado que ele quer no mês seguinte

Decidido com o Matheus em 11 e 12/11/2026. Este documento é a fonte da verdade; o código segue o que está aqui.

## Para que serve

Hoje a meta nasce da régua da COB (docs/placar-benchmark.md) e o cliente não participa. A Sayuri escrevia o que o
cliente dizia na reunião, sem controle. Aqui o cliente diz o que quer, por escrito, uma vez por mês, e o dono responde
com a conta na mão. A nota do cliente, que ninguém pedia, vem junto.

O pedido **não vira meta**. A meta continua sendo a da régua por setor, controlável pela equipe. O dono ajusta a
verba, e o sistema recalcula a meta pela régua, ou responde o que seria preciso para chegar lá. Essa resposta é a
conversa de meta que não acontecia.

## O link

- Um link por cliente, sem login: `/meta/<id do cliente>/<código>`.
- O código são os 10 primeiros caracteres do HMAC-SHA256 de `meta:<id>` com `HUB_SESSION_SECRET`. Não existe coluna
  nova nem token para guardar; trocar o segredo invalida todos os links.
- Código errado ou cliente inativo: página "Esse link não vale mais. Fale com a COB e peça um link novo." A página
  do cliente abre sem a casca do hub (menu, jogador): `SEM_CASCA` no Shell.
- O dono copia o link na ficha do cliente ("Copiar link do pedido") e manda à mão pelo WhatsApp por volta do dia 25.
  Não há disparo automático (decisão de 12/11).
- O proxy libera `/meta/` e `/api/placar/pedido` sem login. Nada mais.

## A página do cliente

Celular primeiro: o cliente abre pelo WhatsApp. Uma tela, três perguntas numeradas, um minuto. Layout de 12/11
("vamos melhorar esse layout"): logo e o mês num chip no topo, nome do cliente em legenda, título em `type-display`
sem o ano, a referência numa faixa própria (rótulo à esquerda, número em `metric-sm` à direita), perguntas em frase
com índice apagado (não em rótulo maiúsculo), campo do número com "R$" como prefixo e a unidade como sufixo, nota
de 0 a 10 em botões (uma linha no computador, duas no celular, 44px de altura, "ruim" e "ótimo" nas pontas),
texto livre em 3 linhas e o botão "Mandar para a COB" com "Leva um minuto. <Dono> responde até o dia 1." embaixo.

- Cabeçalho: "COB" e o nome do cliente. Título: "O que você quer de resultado em dezembro?" (mês seguinte ao atual).
- Referência neutra, sem a meta da COB: "Nas últimas 4 semanas foram 288 contatos." É a mesma conta da nota
  (janela de 4 semanas até a última rodada fechada), na unidade da ficha; em reais, "R$ 794 em vendas". Sem leitura:
  "ainda sem período fechado". Leitura zero conta como sem leitura: "R$ 0 em vendas" não aparece.
- Pergunta 1, obrigatória: "Que resultado você quer em dezembro?" Número e a unidade da ficha (`meta_label`:
  "contatos", "R$ em vendas", "candidatos"). Sem unidade na ficha: "resultados".
- Pergunta 2, obrigatória: "De 0 a 10, como foi o mês que passou com a COB?"
- Pergunta 3, opcional, até 500 caracteres: "O que muda no seu negócio no mês que vem?" (promoção, estoque, férias,
  lançamento).
- Mandar: "Recebido." em `type-display` e "<Dono> responde até o dia 1. Se mudar de ideia, abra este link de novo e
  mande outro número." Mandar de novo no mesmo mês substitui a resposta anterior.
- Copy passa pela régua anti-IA antes de publicar.

## O que acontece com a resposta

- Tabela `placar_pedidos` (supabase/placar-pedidos.sql, aplicada à mão pelo Matheus, nunca `db push`):
  `id` (`<cliente>_<AAAA-MM>`), `client`, `month` (AAAA-MM do mês pedido), `wanted_value`, `wanted_label`, `score`,
  `note`, `created_at`, `answered_at`, `answer`, `accepted` (bool). No arquivo local, chave `pedidos`.
- A nota vira o lançamento de **nota do cliente** da última semana fechada: o campo `client_score` entra no lançamento
  da semana, mantendo o número que já estava lá. É a nota que segura a nota do Placar e que o setor Social exige.
- Ficha do cliente, bloco "Pedido para dezembro": "350 contatos · nota 8 · 'promoção de Natal'", a meta da régua ao
  lado e a **verba que a régua pediria** para o número do cliente (pedido × custo-alvo do degrau mirado; venda: pedido
  ÷ retorno-alvo), arredondada para cima de 10 em 10. Dois caminhos:
  - **Ajustar a verba e recalcular**: a verba da ficha muda, `meta_auto` liga e a meta é recalculada na hora pela
    régua (`autoMetaNow`). Marca `accepted` e grava em `answer` "Verba ajustada para R$ X. Meta pela régua: N".
  - **Manter a régua e responder**: campo de texto com a resposta que o dono vai mandar ao cliente ("Para 350
    contatos ao custo de hoje precisa de R$ 4.000 de verba"). Grava `answer` e `answered_at`. O envio ao cliente é
    pelo WhatsApp, à mão.
- **O pedido nunca vira meta** (Matheus, 12/11: "manter o padrão de metas que puxamos, por setor, playbook, e quero que
  o sistema calcule pela regra"). A meta é sempre a da régua do setor (docs/placar-benchmark.md); o único botão do dono
  é a verba. Cliente fora da régua (sem setor, tipo ou leitura) só tem o caminho da resposta em texto.
- Rodada: cliente com pedido do mês sem `answered_at` ganha a missão **Responder o cliente** (+1), que fecha quando o
  dono responde. Vale o mesmo que a leitura: é trabalho de gestão, não de resultado.
- Pedido não respondido até o dia 1: continua na ficha e na missão até ser respondido. Não some.

## Fora do escopo

- Disparo automático do link (WhatsApp, e-mail).
- Mostrar a meta interna da COB ao cliente.
- Histórico de pedidos na tela (fica no banco; a ficha mostra só o mês corrente e o seguinte).

## Verificação antes de dizer pronto

- Local, no Chrome real: abrir `/meta/azua/<código>` sem login, responder, ver o bloco na ficha, aceitar como meta e
  ver a meta mudar; responder "manter a régua" e ver a missão fechar na Rodada. Código errado dá a página de link
  inválido. Largura 390px sem rolagem lateral. Console limpo.
- Produção: mesma rota com um cliente real, depois do SQL aplicado.
