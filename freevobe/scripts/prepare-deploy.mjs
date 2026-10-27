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

console.log(`deploy/public uppdaterad: ${countFiles(publicDir)} filer.`);
