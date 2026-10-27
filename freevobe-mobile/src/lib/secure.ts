import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Tunn wrapper runt SecureStore med två syften:
 *
 *  1. Nycklarna måste följa plattformens regler (endast a–z, A–Z, 0–9, ".", "-", "_"). Ett ogiltigt
 *     tecken ger annars ett kryptiskt kast mitt i ett användarflöde, så vi kontrollerar själva.
 *  2. SecureStore finns inte på webben. Där faller vi tillbaka på localStorage så att appen kan
 *     köras i webbläsaren under utveckling – medvetet *utan* säkerhetsgaranti, vilket loggas.
 *
 * Värden hålls små: iOS kan neka stora nyckelringsvärden (historiskt runt 2 kB). Därför sparas varje
 * dator för sig i stället för hela listan i en post.
 */

const KEY_PATTERN = /^[A-Za-z0-9._-]+$/;

export function isValidSecureKey(key: string): boolean {
  return key.length > 0 && KEY_PATTERN.test(key);
}

export function assertValidSecureKey(key: string): void {
  if (!isValidSecureKey(key)) {
    throw new Error(
      `Ogiltig nyckel "${key}" för säker lagring. Tillåtna tecken är a–z, A–Z, 0–9, ".", "-" och "_".`,
    );
  }
}

const webFallback = {
  get(key: string): string | null {
    if (typeof window === 'undefined') return null;
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Privat läge eller full kvot – värdet lever då bara i minnet.
    }
  },
  remove(key: string): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Inget att göra.
    }
  },
};

export async function readSecret(key: string): Promise<string | null> {
  assertValidSecureKey(key);
  if (Platform.OS === 'web') return webFallback.get(key);
  try {
    return await SecureStore.getItemAsync(key, { keychainAccessible: SecureStore.WHEN_UNLOCKED });
  } catch {
    // En nyckel som inte längre kan läsas (t.ex. efter ominstallation) behandlas som frånvarande.
    return null;
  }
}

export async function writeSecret(key: string, value: string): Promise<void> {
  assertValidSecureKey(key);
  if (Platform.OS === 'web') {
    webFallback.set(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED,
  });
}

export async function removeSecret(key: string): Promise<void> {
  assertValidSecureKey(key);
  if (Platform.OS === 'web') {
    webFallback.remove(key);
    return;
  }
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // Redan borta.
  }
}

export async function readJson<T>(key: string): Promise<T | null> {
  const raw = await readSecret(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function writeJson(key: string, value: unknown): Promise<void> {
  await writeSecret(key, JSON.stringify(value));
}

/** Endast för test: de nycklar appen skriver till. */
export const storageKeys = {
  connectionIndex: 'freevobe.connection.index',
  activeDesktop: 'freevobe.connection.active',
  desktop: (id: string) => `freevobe.desktop.${id}`,
  settings: 'freevobe.settings',
} as const;
