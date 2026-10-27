/**
 * Node-hook som låter oss köra TypeScript-källkoden direkt, utan byggsteg.
 *
 * Källkoden importerar med `.js`-ändelser (så att den fungerar både för Node och för
 * paketexport). Node själv letar bara efter exakt den filen, så den här hooken provar
 * motsvarande `.ts`-fil och sedan `index.ts` i motsvarande mapp när uppslagningen misslyckas.
 *
 * Registreras av scripts/register-ts.mjs, och används av `npm run dev:server`, binärerna
 * och E2E-testerna. Verktyg som hanterar TypeScript själva (vitest, vite, tsc) påverkas inte.
 */
export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    const relative = specifier.startsWith('./') || specifier.startsWith('../');
    const missing =
      error?.code === 'ERR_MODULE_NOT_FOUND' || error?.code === 'ERR_UNSUPPORTED_DIR_IMPORT';
    if (!missing || !relative) throw error;

    if (specifier.endsWith('.js')) {
      const attempts = [specifier.replace(/\.js$/, '.ts'), specifier.replace(/\.js$/, '.tsx')];
      for (const attempt of attempts) {
        try {
          return await nextResolve(attempt, context);
        } catch {
          // Prova nästa kandidat.
        }
      }
      try {
        return await nextResolve(specifier.replace(/\.js$/, '/index.ts'), context);
      } catch {
        // Faller igenom till originalfelet nedan.
      }
    } else if (!specifier.includes('.')) {
      try {
        return await nextResolve(`${specifier}/index.ts`, context);
      } catch {
        // Faller igenom till originalfelet nedan.
      }
    }

    throw error;
  }
}
