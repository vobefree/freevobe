import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'packages/*/src/**/*.{test,test-d}.ts',
      'packages/*/test/**/*.test.ts',
      'scripts/**/*.test.ts',
      // Skrivbordsappen kör React-tester i jsdom via docblock i respektive testfil.
      'apps/desktop/src/**/*.test.{ts,tsx}',
    ],
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**', 'packages/*/dist/**'],
    environment: 'node',
    globals: false,
    // Testerna renderar den svenska ytan; setupen väljer svenska innan första testet.
    setupFiles: ['apps/desktop/src/test-setup.ts'],
    // Integrationstester startar riktiga processer (Ollama-attrapp, MCP-server, terminal).
    testTimeout: 30_000,
    hookTimeout: 30_000,
    typecheck: {
      enabled: false,
    },
    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage',
      include: ['packages/*/src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/*.test-d.ts', '**/index.ts'],
    },
  },
});
