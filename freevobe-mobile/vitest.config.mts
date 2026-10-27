import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Testerna täcker den rena logiken: protokollmappning, mock-API:t, diffar, parning, notisregler och
 * händelsereducering. Skärmarna verifieras i stället genom att appen bundlas och körs – en riktig
 * komponenttestmiljö för React Native tillförde mer konfiguration än den gav i de här fallen.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    globals: false,
  },
});
