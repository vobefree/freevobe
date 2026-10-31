#!/usr/bin/env node
/**
 * Synkar den statiska exporten (`out/`) till deploy-paketet som manifest.json pekar på.
 *
 *   npm run export          # next build -> out/
 *   npm run deploy:prepare  # out/ -> deploy/public/
 *
 * Servern som hostar paketet behöver bara worker.js + deploy/public; allt annat i deploy/ är
 * konfiguration för lokal verifiering (wrangler).
 */
import { cpSync, existsSync, mkdirSync, rmSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const outDir = join(root, 'out');
const publicDir = join(root, 'deploy', 'public');

if (!existsSync(outDir)) {
  console.error('Hittar ingen export i out/. Kör `npm run export` först.');
  process.exit(1);
}

function countFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).reduce((total, entry) => {
    const path = join(dir, entry.name);
    return total + (entry.isDirectory() ? countFiles(path) : statSync(path).isFile() ? 1 : 0);
  }, 0);
}

rmSync(publicDir, { recursive: true, force: true });
mkdirSync(publicDir, { recursive: true });
cpSync(outDir, publicDir, { recursive: true });

// Varje förrenderad sida finns två gånger: som HTML och som RSC-payload (index.txt) för
// klientnavigering. Tolv språk gånger fyra sidor gör payloadarna så stora att paketet spränger
// värdenens tak på 10 MiB per publicering. HTML:en bär redan allt innehåll, så payloadarna
// stryks: sidorna blir identiska, men klick mellan dem blir en vanlig sidladdning.
const pruned = pruneRscPayloads(publicDir);

function pruneRscPayloads(dir) {
  let removed = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      removed += pruneRscPayloads(path);
    } else if (entry.name === 'index.txt') {
      rmSync(path, { force: true });
      removed += 1;
    }
  }
  return removed;
}

console.log(`deploy/public uppdaterad: ${countFiles(publicDir)} filer (${pruned} RSC-payloads strukna).`);
