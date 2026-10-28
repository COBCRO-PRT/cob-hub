#!/usr/bin/env node
/**
 * ds-check: mede os critérios de pronto do docs/design-system.md (§10) no código.
 *
 *   node scripts/ds-check.mjs            mede tudo e falha se algum limite ativo estourar
 *   node scripts/ds-check.mjs --only a b  mede só os caminhos dados (arquivo ou pasta)
 *   node scripts/ds-check.mjs --inventory imprime só as contagens, nunca falha
 *
 * Um limite `null` ainda não está ativo (a fase 2 zera tela por tela e liga um a um).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const SRC = join(ROOT, "src");

/** Limite por regra. `null` = só inventário. */
const LIMITS = {
  hex: null,
  pxText: null,
  monoNumber: null,
  borderAlpha: null,
  bgAlpha: null,
  zinc: null,
  transitionUnsafe: null,
  deadUi: 0,
  emDash: 0,
};

/** Arquivos que podem ter cor própria (§4): tokens, logo e o confete. */
const HEX_ALLOWED = ["src/app/globals.css", "src/components/Logo.tsx"];
const UI_DIR = "src/components/ui";

const args = process.argv.slice(2);
const inventory = args.includes("--inventory");
const onlyIdx = args.indexOf("--only");
const only = onlyIdx >= 0 ? args.slice(onlyIdx + 1).filter((a) => !a.startsWith("--")) : null;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|css|md)$/.test(name)) out.push(p);
  }
  return out;
}

const all = [...walk(SRC), ...walk(join(ROOT, "docs"))];
const rel = (p) => relative(ROOT, p).split(sep).join("/");
const inScope = (p) => {
  if (!only) return true;
  const r = rel(p);
  return only.some((o) => r === o || r.startsWith(o.replace(/\/$/, "") + "/"));
};

const violations = { hex: [], pxText: [], monoNumber: [], borderAlpha: [], bgAlpha: [], zinc: [], transitionUnsafe: [], deadUi: [], emDash: [] };
const distinct = { borderAlpha: new Set(), bgAlpha: new Set() };

for (const file of all) {
  const r = rel(file);
  const text = readFileSync(file, "utf8");
  const lines = text.split("\n");
  const isCode = /\.tsx?$/.test(r);
  const isUi = r.startsWith(UI_DIR + "/");
  lines.forEach((line, i) => {
    const at = `${r}:${i + 1}`;
    if (line.includes("—")) violations.emDash.push(at);
    if (!isCode || !inScope(file)) return;
    if (line.includes("ds-allow")) return;
    if (!HEX_ALLOWED.includes(r) && /#[0-9a-fA-F]{3,8}\b/.test(line) && /className|style|bg-\[|text-\[|border-\[|from-\[|to-\[|stroke|fill/.test(line)) violations.hex.push(at);
    if (/text-\[\d+(\.\d+)?px\]/.test(line)) violations.pxText.push(at);
    if (/font-mono/.test(line) && /tabular-nums/.test(line)) violations.monoNumber.push(at);
    for (const m of line.matchAll(/border-white\/(\[?[\d.]+\]?)/g)) { distinct.borderAlpha.add(m[1]); violations.borderAlpha.push(`${at} (${m[1]})`); }
    for (const m of line.matchAll(/bg-white\/(\[?[\d.]+\]?)/g)) { distinct.bgAlpha.add(m[1]); violations.bgAlpha.push(`${at} (${m[1]})`); }
    if (/(text|bg|border|placeholder)-zinc-\d+/.test(line)) violations.zinc.push(at);
    if (!isUi && /(^|[\s"'`])(transition(-\w+)?|animate-\w+)(?![=:{])/.test(line) && !/motion-safe:/.test(line)) violations.transitionUnsafe.push(at);
  });
}

// Primitivos mortos: arquivo em components/ui que ninguém importa (fora do index).
const uiFiles = all.filter((f) => rel(f).startsWith(UI_DIR + "/") && /\.tsx$/.test(f));
const codeText = all.filter((f) => /\.tsx?$/.test(f) && !rel(f).endsWith(UI_DIR + "/index.ts")).map((f) => [rel(f), readFileSync(f, "utf8")]);
for (const f of uiFiles) {
  const base = rel(f).replace(/\.tsx$/, "");
  const name = base.split("/").pop();
  const used = codeText.some(([r, t]) => r !== rel(f) && (t.includes(`@/components/ui/${name}`) || (r.startsWith(UI_DIR) && t.includes(`./${name}`)) || t.includes(`@/components/ui"`)));
  if (!used) violations.deadUi.push(rel(f));
}

let failed = false;
for (const [rule, list] of Object.entries(violations)) {
  const n = rule === "borderAlpha" || rule === "bgAlpha" ? distinct[rule].size : list.length;
  const limit = LIMITS[rule];
  const over = limit !== null && !inventory && n > limit;
  const extra = rule === "borderAlpha" || rule === "bgAlpha" ? ` valores: ${[...distinct[rule]].join(" ")}` : "";
  console.log(`${over ? "FALHA" : "ok   "} ${rule.padEnd(17)} ${String(n).padStart(4)} ${limit === null ? "(inventário)" : `(limite ${limit})`}${extra}`);
  if (over) {
    failed = true;
    for (const v of list.slice(0, 40)) console.log(`      ${v}`);
    if (list.length > 40) console.log(`      … e mais ${list.length - 40}`);
  }
}
process.exit(failed ? 1 : 0);
