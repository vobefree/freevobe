/**
 * localStorage kan saknas eller kasta: privat läge, en miljö med opak origin och vissa
 * testmiljöer ger alla `undefined` i stället för ett Storage-objekt. Appen ska fungera ändå –
 * det enda som händer är att valet inte kommer ihåg nästa gång.
 */
export function readStorage(key: string): string | null {
  try {
    return window.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string): void {
  try {
    window.localStorage?.setItem(key, value);
  } catch {
    // Se readStorage: utan lagring fortsätter appen med standardvärdet.
  }
}
