/**
 * Registrerar TypeScript-hooken så att `node --import ../../scripts/register-ts.mjs src/index.ts`
 * kan köra källkoden direkt. Används av utvecklingsservern, binärerna och E2E-testerna.
 */
import { register } from 'node:module';

register(new URL('./ts-resolve.mjs', import.meta.url));
