#!/usr/bin/env node
/**
 * Bundlar agenten (agent-server + agent-core + protocol) till en enda JavaScript-fil.
 *
 * Agenten importerar bara Node:s inbyggda moduler, så bundeln blir en enda fil utan node_modules.
 * Det är förutsättningen för att `scripts/build-sidecar.mjs` ska kunna bädda in den i en
 * fristående binär med Node:s SEA – och därmed för att den installerade appen ska kunna starta
 * agenten på en dator där Node inte är installerat.
 *
 * `playwright` är ett valfritt beroende. Det laddas dynamiskt först när webbläsarautomation
 * används och får därför aldrig bakas in i bundeln.
 *
 * Kör: npm run build --workspace @freevobe/agent-server
 * Resultat: packages/agent-server/dist/freevobe-agent.js
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const outDir = path.join(root, 'packages', 'agent-server', 'dist');
const outFile = path.join(outDir, 'freevobe-agent.js');

/**
 * Startpunkten. `src/index.ts` startar bara sig själv när `process.argv[1]` slutar på index.js/js,
 * och i en SEA-binär är argv[1] sökvägen till binären – därför anropar vi `main` explicit här.
 */
const entrySource = `
import { main } from './packages/agent-server/src/index.ts';

main(process.argv.slice(2)).catch((error) => {
  process.stderr.write(
    \`Freevobe-agenten kunde inte starta: \${error instanceof Error ? error.message : String(error)}\\n\`,
  );
  process.exit(1);
});
`;

/** Paket som medvetet lämnas utanför bundeln och måste finnas installerat först när de används. */
const OPTIONAL_EXTERNALS = new Set(['playwright']);

async function main() {
  fs.mkdirSync(outDir, { recursive: true });

  await build({
    stdin: {
      contents: entrySource,
      resolveDir: root,
      sourcefile: 'freevobe-agent-entry.ts',
      loader: 'ts',
    },
    bundle: true,
    platform: 'node',
    // CommonJS: SEA laddar blobben som ett vanligt skript, och källkoden använder ingen
    // toppnivå-await i den här grafen.
    format: 'cjs',
    target: 'node22',
    outfile: outFile,
    external: [...OPTIONAL_EXTERNALS],
    legalComments: 'none',
    logLevel: 'info',
  });

  // Kontrollen som SEA vilar på: bundeln får bara be om Node:s inbyggda moduler och de valfria
  // beroenden vi uttryckligen tillåter. Fångar att någon lägger till ett npm-beroende i
  // agentkoden – då skulle binären krascha först hos användaren.
  const bundle = fs.readFileSync(outFile, 'utf8');
  const requested = [...bundle.matchAll(/require\("([^"]+)"\)/g)]
    .map((match) => match[1])
    .filter((name) => !name.startsWith('node:') && !OPTIONAL_EXTERNALS.has(name));
  const unexpected = [...new Set(requested)];

  if (unexpected.length > 0) {
    throw new Error(
      `Bundeln kräver paket som inte kan bäddas in: ${unexpected.join(', ')}. ` +
        'Agenten får bara importera Node:s inbyggda moduler (node:*) och godkända valfria beroenden.',
    );
  }

  const size = fs.statSync(outFile).size;
  console.log(`Klart: ${path.relative(root, outFile)} (${Math.round(size / 1024)} kB)`);
}

main().catch((error) => {
  console.error(
    `build:agent misslyckades: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
});
