# Navegação do hub como jogo

Pedido do Matheus em 27/10/2026: "melhore o UX, preciso de facilidade para encontrar os locais e os menus,
como um game". Este documento é a fonte da verdade; o código segue o que está aqui.

## O problema

Cada tela tinha a própria barra ("← menu interno", "Entrou como · Sair"), a home tinha outro cabeçalho e
não existia busca. Para ir do placar ao financeiro era preciso voltar à home. As ferramentas de fora
(ClickUp, Dynamic, Sentinel...) só apareciam na home.

## A barra do jogo (HUD)

Uma barra só, igual em todas as telas do hub, menos nas de login.

- **Esquerda:** logo da COB, que volta para o Início.
- **Mapa (abas):** Início, Placar, Rodada, Financeiro (só para quem é admin). A aba da tela atual fica acesa:
  é o "você está aqui".
- **Rodada** mostra um contador com as missões abertas da semana (as da pessoa; para o admin, as do time).
- **Direita:** botão "Ir para…" com o atalho ⌘K e o cartão do jogador: nome, nível e XP da temporada, com
  a barra até o próximo nível. Clicar abre o menu do jogador (minhas missões, tabela da temporada, sair).
- Sem login individual (só a senha do time), o cartão vira "Entrar" e leva ao login do placar.
- **Celular:** as abas descem para uma barra fixa no rodapé, ao alcance do polegar, como em jogo de celular.

## Menu rápido (⌘K)

Abre com ⌘K (Ctrl+K no Windows) ou com a tecla "/" quando ninguém está digitando. Também pelo botão da barra.

- Um campo de busca que ignora acento e maiúscula, procurando no nome, na descrição e em apelidos.
- Grupos: **Últimos lugares** (os 4 mais recentes deste navegador), **No hub** (telas e pedaços de tela,
  como Missões da semana e Mapa da carteira), **Ferramentas** (tudo que está na home e no rodapé).
- Setas escolhem, Enter abre, Esc fecha. Ferramenta de fora abre em aba nova, igual ao card da home.
- Destinos do financeiro só aparecem para admin.

## Início como tela inicial

- **Continuar:** um card no topo com a rodada da semana (rodada N de 14, quanto falta para fechar e as
  missões abertas da pessoa), com "Continuar a rodada" e "Lançar números". Sem login, convida a entrar.
- **Atalho por número:** cada card da home ganha um número; apertar o número abre o card.

## Fonte dos destinos

`src/lib/destinos.ts` junta as telas do hub e as ferramentas de `catalog.ts`. Card novo na home entra
sozinho no menu rápido.
