/**
 * Filer som agenten aldrig läser eller ändrar åt användaren: nycklar, lösenord och annat som
 * inte ska hamna i en modellkontext. Skyddet gäller alla verktyg, inte bara importerade skills –
 * en instruktion i en fil får aldrig bli en genväg till hemligheterna.
 */

const SENSITIVE_BASENAMES = new Set([
  '.netrc',
  '.npmrc',
  '.git-credentials',
  '.pgpass',
  'credentials',
  'id_rsa',
  'id_ed25519',
  'id_ecdsa',
  'id_dsa',
]);

const SENSITIVE_SEGMENTS = new Set(['.ssh', '.aws', '.gnupg', '.kube', '.docker']);

const SENSITIVE_SUFFIX = /\.(pem|key|p12|pfx|keystore|jks)$/i;
const SENSITIVE_NAMES = /^(secrets?|credentials)\.(json|ya?ml|toml|env)$/i;

/** Sant när sökvägen pekar på något som ser ut som en hemlighet. */
export function isSensitivePath(candidate: string): boolean {
  const normalized = candidate.replace(/\\/g, '/').trim().toLowerCase();
  if (normalized === '') return false;
  const segments = normalized.split('/').filter(Boolean);
  const base = segments.at(-1) ?? '';

  if (base === '.env') return true;
  if (base.startsWith('.env.')) {
    // Mallar med platshållare är ofarliga och används för att sätta upp projektet.
    return !/^\.env\.(example|sample|template|dist)$/.test(base);
  }
  if (SENSITIVE_BASENAMES.has(base)) return true;
  if (segments.some((segment) => SENSITIVE_SEGMENTS.has(segment))) return true;
  if (SENSITIVE_SUFFIX.test(base)) return true;
  return SENSITIVE_NAMES.test(base);
}

/**
 * Förklaringen som verktyget returnerar i stället för innehållet. Den säger vad som hände och
 * vad användaren kan göra själv, så att agenten inte försöker igen på ett annat sätt.
 */
export function sensitivePathMessage(relative: string): string {
  return `Avvisat: ${relative} ser ut att innehålla hemligheter (nycklar, tokens eller inloggningsuppgifter). Freevobe läser och ändrar inte sådana filer åt agenten – öppna den själv om du behöver ändra något.`;
}

/** Null när sökvägen är tillåten, annars meddelandet som ska visas. */
export function sensitivePathRefusal(relative: string): string | null {
  return isSensitivePath(relative) ? sensitivePathMessage(relative) : null;
}
