# Notas fiscais dos clientes

Emissão do lote mensal de NFS-e em `/financeiro/notas`, a partir das assinaturas
do Asaas. Substitui o trabalho de emitir uma por uma no portal da prefeitura de
Farroupilha.

## Como funciona

O Asaas é a fonte da verdade. A tela lê as **assinaturas ativas mensais**, cruza
com as notas já emitidas no mês e mostra o que falta. **Nada é criado no Asaas
até alguém clicar em Emitir**: a emissão automática nativa do Asaas está
desligada de propósito, para não existir nota saindo sozinha de madrugada.

Não há banco de dados. Cada nota recebe a referência determinística
`cob-{AAAAMM}-{idDaAssinatura}` no campo `externalReference` do Asaas. Se a
referência já existe no mês, a linha aparece como emitida e o botão some, então
clicar duas vezes não duplica nota.

A área tem **senha própria** (`HUB_FINANCE_PASSWORD`, sessão de 12 horas) por
cima da senha do time, porque emitir nota fiscal é irreversível na prática.

## Dados fiscais da COB

Lidos do cadastro real no portal da prefeitura, não são chute:

- COLOMBO PUBLICIDADE LTDA, CNPJ 41.264.322/0001-25
- Inscrição Municipal **25203**, série DPS 999
- **Simples Nacional**, então o ISS sai **0,00** na nota (é recolhido no DAS)
- Serviço em uso: **`170201`** (item 17.02 da LC 116, que inclui edição, redação
  e revisão no texto completo). Os outros cadastrados são `170601` propaganda e
  publicidade, `100801` agenciamento de publicidade e `100701` agenciamento de
  notícias.

## Variáveis de ambiente

| Variável | Valor | Observação |
|---|---|---|
| `ASAAS_API_KEY` | `$aact_prod_...` | veja o gotcha do cifrão abaixo |
| `ASAAS_AMBIENTE` | `producao` ou `sandbox` | sandbox é o padrão se omitida |
| `HUB_FINANCE_PASSWORD` | senha do financeiro | diferente da senha do time |
| `NF_SERVICO_CODIGO` | `170201` | código do serviço na prefeitura |
| `NF_SERVICO_NOME` | Datilografia, digitação... | descritivo |
| `NF_SERVICO_ID` | (vazio) | id do Asaas; só existe depois de configurar a emissão lá |
| `NF_SIMPLES_NACIONAL` | `true` | evita alarme falso de ISS zerado |
| `NF_ISS` e demais impostos | `0` | confirmar retenções com o contador |
| `NF_DESCRICAO_PADRAO` | texto | usado quando a assinatura não tem descrição |

### Gotcha do cifrão

A chave do Asaas começa com `$`, e **o Next expande variáveis no `.env`**, então
ela chega como string vazia na aplicação. Aspas simples e duplas não resolvem.

- No **`.env.local`**: escreva com barra, `ASAAS_API_KEY=\$aact_prod_...`
- Na **Vercel**: cole o valor **puro, sem a barra** (o painel guarda literal)
- O `scripts/nf-diagnostico.mjs` remove a barra sozinho, porque o
  `node --env-file` não expande nada

Conferir com o parser real do Next:

```bash
node -e "require('@next/env').loadEnvConfig(process.cwd()); console.log(process.env.ASAAS_API_KEY?.length)"
```

## Diagnóstico

Responde se a chave autentica, se a emissão está habilitada, quais serviços
municipais o Asaas expõe e quais assinaturas virariam nota. **Não emite nada.**

```bash
node --env-file=.env.local scripts/nf-diagnostico.mjs
```

## O que falta para emitir de verdade

1. **Certificado A1 vigente.** O que existe venceu em 30/01/2025. Vencido não se
   renova: é emissão nova, cerca de R$ 188, com videoconferência de 15 a 20
   minutos e liberação no mesmo dia.
2. Rodar o assistente em **Notas Fiscais > Configurações** no Asaas com esse
   certificado. Só depois disso o Asaas expõe o `municipalServiceId` filtrado
   pela prefeitura, que deve substituir o código manual.
3. Emitir **uma** nota, conferir em `nfse.farroupilha.rs.gov.br`, e só então
   usar o botão de emitir o lote.

## Prazos da prefeitura

Ato Conjunto RFB/CGIBS nº 4 de 30/07/2026:

- **01/11/2026**: emissão passa a ser obrigatória pelo **Portal Nacional**. Vai
  exigir mudar a configuração no Asaas, que tem a chave "emito NFS-e pelo portal
  nacional".
- IBS/CBS na nota: 01/10/2026 para a maioria, **01/01/2027 para optantes do
  Simples**, que é o caso da COB.
