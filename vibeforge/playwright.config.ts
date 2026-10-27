import { defineConfig, devices } from '@playwright/test';

const AGENT_PORT = 4319;
const FAKE_OLLAMA_PORT = 4399;
const WEB_PORT = 1420;

/**
 * E2E-testerna kör mot den riktiga agent-servern med en fejkad Ollama, så att hela kedjan
 * prompt → verktygsanrop → godkännande → diff → skrivning kan verifieras utan en modell.
 *
 * Databasen är i minnet (VIBEFORGE_E2E=1) och dev-token är påslagen, så inget tillstånd
 * ligger kvar mellan körningar.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: `http://127.0.0.1:${WEB_PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'api',
      testMatch: /.*\.api\.spec\.ts/,
    },
    {
      name: 'ui',
      testMatch: /.*\.ui\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: [
    {
      command: `node e2e/fixtures/fake-ollama.mjs --port=${FAKE_OLLAMA_PORT}`,
      port: FAKE_OLLAMA_PORT,
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      timeout: 30_000,
    },
    {
      command: `node packages/agent-server/bin/vibeforge-agent.mjs --port=${AGENT_PORT}`,
      port: AGENT_PORT,
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      timeout: 60_000,
      env: {
        VIBEFORGE_E2E: '1',
        VIBEFORGE_DEV: '1',
      },
    },
    {
      command: 'npm run dev --workspace @vibeforge/desktop',
      port: WEB_PORT,
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      timeout: 90_000,
    },
  ],
});
