/**
 * Diagnóstico da emissão de NF no Asaas.
 *
 * Responde três perguntas, sem emitir nada e sem criar nada:
 *   1. A chave autentica e em qual ambiente
 *   2. A emissão de nota está habilitada e Farroupilha é suportada
 *   3. Quais assinaturas ativas virariam nota no lote mensal
 *
 * Uso: node --env-file=.env.local scripts/nf-diagnostico.mjs
 */

// O .env.local guarda a chave como \$aact... porque o Next expande variáveis e
// comeria o valor. O --env-file do node não expande, então a barra chega aqui
// literal e precisa sair.
const CHAVE = process.env.ASAAS_API_KEY?.replace(/^\\/, "");
const AMBIENTE = process.env.ASAAS_AMBIENTE === "producao" ? "producao" : "sandbox";
const BASE = AMBIENTE === "producao" ? "https://api.asaas.com/v3" : "https://api-sandbox.asaas.com/v3";

if (!CHAVE) {
  console.error("ASAAS_API_KEY não está no .env.local. Sem ela não dá pra consultar nada.");
  process.exit(1);
}

async function pegar(rota) {
  const resposta = await fetch(`${BASE}${rota}`, {
    headers: { access_token: CHAVE, "Content-Type": "application/json", "User-Agent": "cob-hub" },
  });
  const texto = await resposta.text();
  let corpo;
  try {
    corpo = texto ? JSON.parse(texto) : null;
  } catch {
    corpo = texto;
  }
  return { ok: resposta.ok, status: resposta.status, corpo };
}

const real = (n) => (n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

console.log(`\nAmbiente: ${AMBIENTE}  (${BASE})\n`);

// 1. A chave funciona?
const conta = await pegar("/myAccount");
if (!conta.ok) {
  console.error(`Autenticação falhou: HTTP ${conta.status}`);
  console.error(JSON.stringify(conta.corpo, null, 2));
  console.error("\nChave de produção não funciona na URL de sandbox, e vice-versa.");
  process.exit(1);
}
const dono = conta.corpo?.name ?? conta.corpo?.companyName ?? "(sem nome)";
const cidade = conta.corpo?.cityName ?? conta.corpo?.city ?? "(não informada)";
console.log(`Conta: ${dono}`);
console.log(`CNPJ:  ${conta.corpo?.cpfCnpj ?? "(não informado)"}`);
console.log(`Cidade do cadastro: ${cidade}\n`);

// 2. A emissão de nota está de pé?
const fiscal = await pegar("/fiscalInfo");
if (fiscal.ok && fiscal.corpo) {
  const f = fiscal.corpo;
  console.log("Informações fiscais:");
  console.log(`  emissão habilitada: ${f.serviceInvoiceEnabled ?? "(campo ausente)"}`);
  console.log(`  município:          ${f.municipalInscription ? "inscrição " + f.municipalInscription : "sem inscrição municipal"}`);
  console.log(`  certificado:        ${f.certificateExpirationDate ? "vence em " + f.certificateExpirationDate : "não enviado"}`);
  if (f.simplesNacional !== undefined) console.log(`  simples nacional:   ${f.simplesNacional}`);
} else {
  console.log(`Informações fiscais: HTTP ${fiscal.status} — a emissão de NF ainda não foi configurada nesta conta.`);
}

const servicos = await pegar("/fiscalInfo/services?limit=100");
console.log("");
if (servicos.ok && Array.isArray(servicos.corpo?.data)) {
  const lista = servicos.corpo.data;
  console.log(`Serviços municipais disponíveis: ${lista.length}`);
  if (lista.length === 0) {
    console.log("  Lista vazia. Ou a prefeitura não publica os códigos, ou a conta ainda");
    console.log("  não está credenciada. Nesse caso o código do serviço entra à mão.");
  }
  for (const s of lista.slice(0, 15)) {
    console.log(`  ${s.id}  ISS ${s.issTax}%  ${s.description}`);
  }
  if (lista.length > 15) console.log(`  ... e mais ${lista.length - 15}`);
} else {
  console.log(`Serviços municipais: HTTP ${servicos.status}`);
  console.log(`  ${JSON.stringify(servicos.corpo)}`);
}

// 3. O que viraria nota no lote deste mês
const assinaturas = await pegar("/subscriptions?status=ACTIVE&limit=100");
console.log("");
if (assinaturas.ok && Array.isArray(assinaturas.corpo?.data)) {
  const ativas = assinaturas.corpo.data;
  const mensais = ativas.filter((a) => a.cycle === "MONTHLY");
  console.log(`Assinaturas ativas: ${ativas.length}  (mensais: ${mensais.length})`);

  const total = mensais.reduce((soma, a) => soma + (a.value ?? 0), 0);
  for (const a of mensais.slice(0, 30)) {
    const desc = (a.description ?? "sem descrição").slice(0, 44);
    console.log(`  ${real(a.value).padStart(14)}  ${a.customer}  ${desc}`);
  }
  if (mensais.length > 30) console.log(`  ... e mais ${mensais.length - 30}`);
  console.log(`\n  Total mensal do lote: ${real(total)}`);
} else {
  console.log(`Assinaturas: HTTP ${assinaturas.status} — ${JSON.stringify(assinaturas.corpo)}`);
}

console.log("");
