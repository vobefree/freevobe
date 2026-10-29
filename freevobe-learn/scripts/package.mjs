import { copyFileSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/*
 * Bygget är en enda HTML-fil (allt inlinat), så "nedladdningen" är helt enkelt filen.
 * Här kopieras den till release/ tillsammans med en kort lapp om hur den öppnas.
 */
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const built = join(root, 'dist', 'index.html');
const outDir = join(root, 'release');
const target = join(outDir, 'freevobe-learn.html');

mkdirSync(outDir, { recursive: true });
copyFileSync(built, target);

const bytes = statSync(target).size;
console.log(`freevobe-learn.html – ${(bytes / 1024).toFixed(1)} kB`);
