/** Småhjälpare som används på flera skärmar. Rena funktioner, lätta att testa. */

export function newId(prefix: string): string {
  return `${prefix}.${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** "nu", "4 min", "3 tim", "2 dagar" – kort nog för en lista på telefonen. */
export function formatRelativeTime(timestamp: number, now = Date.now()): string {
  if (!timestamp) return '';
  const seconds = Math.max(0, Math.round((now - timestamp) / 1000));
  if (seconds < 45) return 'nu';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} tim`;
  const days = Math.round(hours / 24);
  if (days < 7) return days === 1 ? '1 dag' : `${days} dagar`;
  const weeks = Math.round(days / 7);
  return weeks === 1 ? '1 vecka' : `${weeks} veckor`;
}

export function formatClock(timestamp: number): string {
  const date = new Date(timestamp);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** Kortar sökvägar i mitten så att filnamnet alltid syns. */
export function shortenPath(path: string, maxLength = 34): string {
  if (path.length <= maxLength) return path;
  const parts = path.split('/');
  const file = parts[parts.length - 1] ?? path;
  if (file.length >= maxLength) return `…${file.slice(-(maxLength - 1))}`;
  const head = path.slice(0, maxLength - file.length - 2);
  return `${head}…/${file}`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.max(1, Math.round(ms))} ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)} s`;
  return `${Math.floor(seconds / 60)} min ${Math.round(seconds % 60)} s`;
}

export function plural(count: number, singular: string, pluralForm: string): string {
  return count === 1 ? `${count} ${singular}` : `${count} ${pluralForm}`;
}
