import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Regressionsvakt: Tauri injicerar CSP:n i appen. Utan `frame-src` faller ramar tillbaka på
 * `default-src 'self'`, och då blockeras preview-iframen mot 127.0.0.1 – appen visar en tom ruta.
 */
describe('CSP för preview', () => {
  it('tillåter iframe mot loopback', () => {
    const file = fileURLToPath(new URL('../../src-tauri/tauri.conf.json', import.meta.url));
    const config = JSON.parse(readFileSync(file, 'utf8')) as {
      app: { security: { csp: string } };
    };
    const csp = config.app.security.csp;

    expect(csp).toMatch(/frame-src[^;]*http:\/\/127\.0\.0\.1:\*/);
    expect(csp).toMatch(/frame-src[^;]*http:\/\/localhost:\*/);
    // Preview får aldrig bäddas in från en extern adress.
    // Enbart port-wildcard är tillåtet – aldrig en helt öppen `frame-src *`.
    expect(csp).not.toMatch(/frame-src(?:\s+[^;]*)?\s\*(\s*;|\s*$)/);
  });
});
