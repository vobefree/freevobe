import type { SavedDesktop } from './types';
import { createHttpApi } from './http';
import { createMockApi } from './mock';
import type { FreevobeApi } from './client';

/**
 * Enda stället där valet mellan mock och riktig dator görs. Byter du till en riktig Freevobe Desktop
 * är det här – och ingenting annat – som ändras: alla skärmar använder `FreevobeApi`.
 */

export interface ApiContext {
  desktop: SavedDesktop | null;
  projectId: string | null;
  /** Tvinga mock även när en dator är parad (används av demosläget i inställningarna). */
  forceMock?: boolean;
}

export function shouldUseMock(context: ApiContext): boolean {
  return context.forceMock === true || context.desktop === null;
}

export function createApi(context: ApiContext): FreevobeApi {
  if (shouldUseMock(context) || !context.desktop) return createMockApi();
  return createHttpApi({
    baseUrl: context.desktop.url,
    token: context.desktop.token,
    projectId: context.projectId ?? '',
  });
}

/**
 * En klient per anslutning, delad av hela appen.
 *
 * Varje `createApi`-anrop ger en egen klient med eget tillstånd – och mock-klienten *är* sitt tillstånd
 * (körningar, godkännanden, loggar). Skapade varje hook sin egen klient skulle en körning startas i en
 * instans och strömmen prenumereras i en annan, och skärmarna skulle visa olika världar. Därför
 * cachas klienten på anslutningens identitet.
 */
let cached: { key: string; api: FreevobeApi } | null = null;

export function apiCacheKey(context: ApiContext): string {
  return [
    context.forceMock ? 'mock' : 'live',
    context.desktop?.id ?? 'ingen-dator',
    context.desktop?.url ?? '',
    context.projectId ?? '',
  ].join('|');
}

/** Hämtar (eller skapar) klienten för en anslutning. */
export function getApi(context: ApiContext): FreevobeApi {
  const key = apiCacheKey(context);
  if (cached?.key === key) return cached.api;
  cached = { key, api: createApi(context) };
  return cached.api;
}

/** Endast för test: glöm den cachade klienten. */
export function resetApiCache(): void {
  cached = null;
}

/** Mock-läget är standard första gången appen öppnas, så att den går att titta på direkt. */
export function defaultApiContext(): ApiContext {
  return { desktop: null, projectId: null };
}

export { ApiError } from './client';
export type { FreevobeApi } from './client';
export * from './types';
