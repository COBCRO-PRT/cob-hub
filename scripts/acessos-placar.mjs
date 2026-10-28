#!/usr/bin/env node
/**
 * Gera as senhas do login individual do Placar (HUB_USERS).
 *
 *   node scripts/acessos-placar.mjs --senhas <arquivo> --usuarios <arquivo> [--base <arquivo>] [pessoa ...]
 *
 * pessoa = id:Nome:papel (papel "admin" entra no financeiro, "time" não).
 * Sem pessoas, gera as 4 de sempre. Com --base, mantém quem já está no arquivo
 * e troca só as pessoas listadas (é assim que se reseta a senha de alguém).
 *
 * A senha em texto vai só para o arquivo de --senhas (permissão 600), para o
 * Matheus repassar e apagar. O terminal nunca mostra senha. O arquivo de
 * --usuarios tem só o hash e é o valor da HUB_USERS na Vercel.
 */
import { pbkdf2Sync, randomBytes, randomInt } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, chmodSync } from "node:fs";

const PADRAO = ["matheus:Matheus:admin", "sayuri:Sayuri:time", "ramon:Ramon:time", "israel:Israel:time"];
const ITERACOES = 600_000;
// Sem 0/o, 1/l/i: a senha vai ser digitada no celular.
const ALFABETO = "abcdefghjkmnpqrstuvwxyz23456789";

const args = process.argv.slice(2);
const opt = (nome) => {
  const i = args.indexOf(nome);
  if (i === -1) return undefined;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};
const arqSenhas = opt("--senhas");
const arqUsuarios = opt("--usuarios");
const arqBase = opt("--base");
if (!arqSenhas || !arqUsuarios) {
  console.error("Uso: --senhas <arquivo> --usuarios <arquivo> [--base <arquivo>] [id:Nome:papel ...]");
  process.exit(1);
}

const pessoas = (args.length ? args : PADRAO).map((p) => {
  const [id, name, role] = p.split(":");
  if (!/^[a-z0-9-]+$/.test(id ?? "") || !name || (role !== "admin" && role !== "time")) {
    console.error(`Pessoa inválida: ${p}`);
    process.exit(1);
  }
  return { id, name, role };
});

const b64url = (buf) => buf.toString("base64url");
const senha = () =>
  Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => ALFABETO[randomInt(ALFABETO.length)]).join("")).join("-");

const base = arqBase && existsSync(arqBase) ? JSON.parse(readFileSync(arqBase, "utf8")) : [];
const usuarios = base.filter((u) => !pessoas.some((p) => p.id === u.id));
const linhas = [];

for (const p of pessoas) {
  const s = senha();
  const salt = randomBytes(16);
  const hash = pbkdf2Sync(s, salt, ITERACOES, 32, "sha256");
  usuarios.push({ ...p, hash: `pbkdf2-sha256$${ITERACOES}$${b64url(salt)}$${b64url(hash)}` });
  linhas.push(["Placar de Clientes COB", "https://cob-hub.vercel.app/placar", `Nome: ${p.name}`, `Senha: ${s}`, ""].join("\n"));
}

const texto = [
  `Gerado em ${new Date().toLocaleString("pt-BR")}. Cada bloco abaixo é de uma pessoa:`,
  "mande no privado de cada um e apague este arquivo.",
  "",
  "----------------------------------------",
  "",
  ...linhas.flatMap((l) => [l, "----------------------------------------", ""]),
].join("\n");

writeFileSync(arqSenhas, texto, { mode: 0o600 });
chmodSync(arqSenhas, 0o600);
writeFileSync(arqUsuarios, JSON.stringify(usuarios), { mode: 0o600 });
chmodSync(arqUsuarios, 0o600);

console.log(`${pessoas.length} senha(s) gerada(s): ${pessoas.map((p) => p.name).join(", ")}.`);
console.log(`Senhas em ${arqSenhas}. HUB_USERS em ${arqUsuarios} (${usuarios.length} pessoa(s)).`);
