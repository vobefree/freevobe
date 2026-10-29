#!/usr/bin/env node
/**
 * Paketerar agenten till en fristående binär som skrivbordsappen kan starta utan att Node är
 * installerat. Använder Node:s inbyggda Single Executable Application (SEA) på den bundlade
 * agenten från `scripts/build-agent.mjs`.
 *
 * Kör: npm run sidecar:build
 *
 * Resultat:
 *   apps/desktop/src-tauri/binaries/freevobe-agent-<trippel>[.exe]   – plockas upp av Tauri
 *     genom `bundle.externalBin` och hamnar bredvid appens egen binär i paketet.
 *   apps/desktop/src-tauri/builtin-skills/                            – de inbyggda skillsen, som
 *     paketeras som resurs eftersom de inte kan bäddas in i en SEA-binär.
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
const bundle = path.join(root, 'packages', 'agent-server', 'dist', 'freevobe-agent.js');
const skillsSource = path.join(root, 'packages', 'agent-core', 'builtin-skills');
const tauriDir = path.join(root, 'apps', 'desktop', 'src-tauri');
const outDir = path.join(tauriDir, 'binaries');
const skillsTarget = path.join(tauriDir, 'builtin-skills');
// postject körs via paketets egen CLI i stället för `npx`: samma sak på alla plattformar
// (`npx` är ett skalskript på Windows) och utan nätverk mitt i ett releasebygge.
const postjectCli = path.join(root, 'node_modules', 'postject', 'dist', 'cli.js');
/** Sentineln som Node letar efter i binären för att hitta den injicerade blobben. */
const SEA_FUSE = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2';
const targetSuffix = process.platform === 'win32' ? '.exe' : '';

/**
 * Tauri kräver att sidobinären heter `<namn>-<mål-trippel>`, så namnet måste följa byggmaskinen.
 * Går att peka ut explicit med `--triple=<trippel>` eller FREEVOBE_TRIPLE.
 */
const TRIPLES = {
  'win32-x64': 'x86_64-pc-windows-msvc',
  'win32-arm64': 'aarch64-pc-windows-msvc',
  'darwin-x64': 'x86_64-apple-darwin',
  'darwin-arm64': 'aarch64-apple-darwin',
  'linux-x64': 'x86_64-unknown-linux-gnu',
  'linux-arm64': 'aarch64-unknown-linux-gnu',
};

function resolveTriple() {
  const fromArgs = process.argv.find((arg) => arg.startsWith('--triple='))?.split('=')[1];
  const explicit = fromArgs ?? process.env.FREEVOBE_TRIPLE;
  if (explicit?.trim()) return explicit.trim();

  const triple = TRIPLES[`${process.platform}-${process.arch}`];
  if (!triple) {
    throw new Error(
      `Ingen känd mål-trippel för ${process.platform}/${process.arch}. Ange en med --triple=.`,
    );
  }
  return triple;
}

function run(command, args, options = {}) {
  console.log(`$ ${command} ${args.join(' ')}`);
  execFileSync(command, args, { stdio: 'inherit', cwd: root, ...options });
}

/** De inbyggda skillsen är markdown-filer som läses vid körning och därför paketeras som resurs. */
function copyBuiltinSkills() {
  fs.rmSync(skillsTarget, { recursive: true, force: true });
  fs.mkdirSync(skillsTarget, { recursive: true });
  const files = fs.readdirSync(skillsSource).filter((file) => file.endsWith('.md'));
  for (const file of files) {
    fs.copyFileSync(path.join(skillsSource, file), path.join(skillsTarget, file));
  }
  console.log(`Kopierade ${files.length} inbyggda skills till ${path.relative(root, skillsTarget)}.`);
}

function main() {
  if (!fs.existsSync(bundle)) {
    throw new Error(
      `Hittade inte ${path.relative(root, bundle)}. Kör "npm run build --workspace @freevobe/agent-server" först.`,
    );
  }
  if (!fs.existsSync(postjectCli)) {
    throw new Error(
      `Hittade inte ${path.relative(root, postjectCli)}. Kör "npm install" i freevobe först.`,
    );
  }

  const triple = resolveTriple();
  fs.mkdirSync(outDir, { recursive: true });
  copyBuiltinSkills();

  const seaConfigPath = path.join(outDir, 'sea-config.json');
  const blobPath = path.join(outDir, 'freevobe-agent.blob');
  const binaryPath = path.join(outDir, `freevobe-agent-${triple}${targetSuffix}`);

  fs.writeFileSync(
    seaConfigPath,
    JSON.stringify(
      {
        // Absoluta sökvägar: Node letar inte alltid relativt konfigfilen (på Windows görs det
        // relativt arbetskatalogen), och då hittas inte bundeln.
        main: bundle,
        output: blobPath,
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
  run(process.execPath, [
    postjectCli,
    binaryPath,
    'NODE_SEA_BLOB',
    blobPath,
    '--sentinel-fuse',
    SEA_FUSE,
  ]);
  if (process.platform === 'darwin') {
    run('codesign', ['--sign', '-', binaryPath]);
  }

  fs.rmSync(blobPath, { force: true });

  console.log(
    `\nKlart: ${path.relative(root, binaryPath)} (${os.platform()}/${os.arch()} → ${triple})`,
  );
  console.log('Tauri paketerar binären via bundle.externalBin och hittar den bredvid appens binär.');
}

try {
  main();
} catch (error) {
  console.error(
    `sidecar:build misslyckades: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
}
