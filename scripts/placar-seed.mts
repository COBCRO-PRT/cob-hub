/**
 * Semente do Placar de Clientes.
 *
 * Lê uma pasta de JSON (um arquivo por cliente, id = nome do arquivo) e grava
 * pela mesma camada de store que o app usa:
 * - com PLACAR_SUPABASE_URL e PLACAR_SUPABASE_SERVICE_KEY, no Supabase;
 * - sem elas, no arquivo local de desenvolvimento (PLACAR_FILE ou
 *   ~/.cob-hub/placar-dev.json).
 *
 * Idempotente: cliente que já existe fica como está (o time pode ter editado).
 * Com --overwrite, substitui pelo JSON.
 *
 * Uso:
 *   node --env-file=.env.local scripts/placar-seed.mts <pasta-com-json> [--overwrite]
 */
import { readdir, readFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import type * as StoreModule from "../src/lib/placar/store";

async function main() {
  const args = process.argv.slice(2);
  const overwrite = args.includes("--overwrite");
  const dir = args.find((a) => !a.startsWith("--"));
  if (!dir) {
    console.error("Uso: node --env-file=.env.local scripts/placar-seed.mts <pasta-com-json> [--overwrite]");
    process.exit(1);
  }

  // Import pelo caminho .ts para o Node rodar o arquivo direto (type stripping).
  const storeUrl = new URL("../src/lib/placar/store.ts", import.meta.url).href;
  const { getStore, normalizeClient }: typeof StoreModule = await import(storeUrl);

  const store = await getStore();
  console.log(`Gravando em: ${store.kind} (${store.where})${overwrite ? ", substituindo o que existir" : ""}`);

  const files = (await readdir(resolve(dir))).filter((f) => f.endsWith(".json")).sort();
  if (!files.length) {
    console.error(`Nenhum .json em ${resolve(dir)}.`);
    process.exit(1);
  }

  let written = 0;
  let kept = 0;
  const problems: string[] = [];

  for (const f of files) {
    const id = basename(f, ".json");
    let raw: Record<string, unknown>;
    try {
      raw = JSON.parse(await readFile(join(resolve(dir), f), "utf8"));
    } catch (e) {
      problems.push(`${f}: JSON inválido (${(e as Error).message})`);
      continue;
    }
    const client = normalizeClient({ ...raw, id });
    if (!client.name) {
      problems.push(`${f}: sem nome`);
      continue;
    }
    if ((await store.seedClient(client, overwrite)) === true) written++;
    else kept++;
  }

  console.log(`${files.length} arquivos · ${written} gravados · ${kept} já existiam e ficaram como estavam`);
  if (problems.length) {
    console.error(`Com problema (${problems.length}):\n  ${problems.join("\n  ")}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
