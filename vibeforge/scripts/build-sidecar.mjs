#!/usr/bin/env node
/**
 * Paketerar VibeForge-agenten till en fristående binär som skrivbordsappen kan starta utan
 * att Node är installerat. Använder Node:s inbyggda Single Executable Application (SEA).
 *
 * Kör: npm run sidecar:build
 *
 * Resultatet hamnar i apps/desktop/src-tauri/binaries/ och plockas upp av skalet via
 * VIBEFORGE_AGENT_BIN eller genom att läggas i appens resurskatalog vid paketering.
 *
 * Krav: Node 22.5 eller senare (där --experimental-sea-config finns).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const serverDist = path.join(root, 'packages', 'agent-server', 'dist', 'index.js');
const outDir = path.join(root, 'apps', 'desktop', 'src-tauri', 'binaries');
const targetSuffix = process.platform === 'win32' ? '.exe' : '';

function run(command, args, options = {}) {
  console.log(`$ ${command} ${args.join(' ')}`);
  execFileSync(command, args, { stdio: 'inherit', cwd: root, ...options });
}

function main() {
  if (!fs.existsSync(serverDist)) {
    throw new Error(
      `Hittade inte ${path.relative(root, serverDist)}. Kör "npm run build --workspace @vibeforge/agent-server" först.`,
    );
  }

  fs.mkdirSync(outDir, { recursive: true });
  const seaConfigPath = path.join(outDir, 'sea-config.json');
  const blobPath = path.join(outDir, 'vibeforge-agent.blob');
  const binaryPath = path.join(outDir, `vibeforge-agent${targetSuffix}`);

  fs.writeFileSync(
    seaConfigPath,
    JSON.stringify(
      {
        main: path.relative(path.dirname(seaConfigPath), serverDist),
        output: path.relative(path.dirname(seaConfigPath), blobPath),
        disableExperimentalSEAWarning: true,
        useSnapshot: false,
        useCodeCache: false,
      },
      null,
      2,
    ),
  );

  run(process.execPath, ['--experimental-sea-config', path.relative(root, seaConfigPath)]);

  // Utgå från den aktuella Node-binären och injicera blobben.
  fs.copyFileSync(process.execPath, binaryPath);
  if (process.platform === 'darwin') {
    run('codesign', ['--remove-signature', binaryPath]);
  }
  run('npx', [
    '--yes',
    'postject',
    binaryPath,
    'NODE_SEA_BLOB',
    blobPath,
    '--sentinel-fuse',
    'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2',
  ]);
  if (process.platform === 'darwin') {
    run('codesign', ['--sign', '-', binaryPath]);
  }

  console.log(`\nKlart: ${path.relative(root, binaryPath)} (${os.platform()}/${os.arch()})`);
  console.log('Skalet hittar binären automatiskt när den ligger i appens resurskatalog.');
}

try {
  main();
} catch (error) {
  console.error(
    `sidecar:build misslyckades: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
}
