#!/usr/bin/env node
/**
 * Startar Freevobe-agenten från källkoden. Skrivbordsappen använder den här binären i
 * utvecklingsläge; i ett paketerat bygge används en fristående binär (npm run sidecar:build).
 *
 *   vibeforge-agent [--port=4319]
 */
import { register } from 'node:module';

register(new URL('../../../scripts/ts-resolve.mjs', import.meta.url));

const { main } = await import('../src/index.ts');

try {
  await main(process.argv.slice(2));
} catch (error) {
  process.stderr.write(
    `Freevobe-agenten kunde inte starta: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
}
