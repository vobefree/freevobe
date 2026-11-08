/**
 * jsdom 26 på Node 26 kan ge ett `window` utan `localStorage`. Testerna kontrollerar att språkval
 * och onboarding sparas, så de behöver en riktig Storage. Den här lilla minnesbaserade varianten
 * beter sig som webbläsarens och påverkar bara testprocessen – appens kod har egna skydd.
 */
if (typeof window !== 'undefined' && !window.localStorage) {
  const entries = new Map<string, string>();

  const storage: Storage = {
    get length() {
      return entries.size;
    },
    clear: () => {
      entries.clear();
    },
    getItem: (key: string) => entries.get(key) ?? null,
    key: (index: number) => [...entries.keys()][index] ?? null,
    removeItem: (key: string) => {
      entries.delete(key);
    },
    setItem: (key: string, value: string) => {
      entries.set(key, String(value));
    },
  };

  Object.defineProperty(window, 'localStorage', { value: storage, configurable: true });
}
