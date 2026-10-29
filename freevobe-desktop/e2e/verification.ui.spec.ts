import { expect, test, type APIRequestContext } from '@playwright/test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { AGENT, FAKE_OLLAMA, MODEL } from './fixtures/env';

async function devToken(request: APIRequestContext): Promise<string> {
  const response = await request.get(`${AGENT}/api/dev-token`);
  const payload = (await response.json()) as { data: { token: string } };
  return payload.data.token;
}

/**
 * Verification Engine i en riktig webbläsare: när agenten ändrat en fil körs projektets egna
 * kontroller automatiskt och rapporten hamnar i högerpanelen.
 */
test.describe('Verification Engine', () => {
  let projectRoot: string;
  let token: string;

  test.beforeAll(async ({ request }) => {
    token = await devToken(request);
    await request.patch(`${AGENT}/api/settings`, {
      headers: { 'x-freevobe-token': token },
      data: {
        ollamaBaseUrl: FAKE_OLLAMA,
        defaultModel: MODEL,
        permissionMode: 'auto-edit',
        verifyAfterRun: true,
      },
    });

    projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'freevobe-verify-ui-'));
    await fs.mkdir(path.join(projectRoot, 'src'), { recursive: true });
    await fs.writeFile(
      path.join(projectRoot, 'package.json'),
      JSON.stringify(
        {
          name: 'verifieringsprojekt',
          private: true,
          scripts: {
            typecheck: 'node -e "console.log(\'inga typfel\')"',
            lint: 'node -e "console.log(\'ren kod\')"',
            test: 'node -e "console.log(\'Tests  3 passed (3)\')"',
          },
        },
        null,
        2,
      ),
    );
  });

  test.afterAll(async () => {
    await fs.rm(projectRoot, { recursive: true, force: true }).catch(() => undefined);
  });

  test('verifierar automatiskt efter en körning och visar rapporten', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('freevobe.onboardingComplete', '1');
    });

    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await page.goto('/');
    await page.getByTestId('open-project-path').fill(projectRoot);
    await page.getByTestId('open-project').click();
    await expect(page.getByText('package.json').first()).toBeVisible({ timeout: 20_000 });

    // Skrivningar går igenom utan godkännandekort; verifieringen är det som testas här.
    await page.getByTestId('permission-mode').selectOption('auto-edit');
    await page.getByTestId('new-session').click();
    const composer = page.getByTestId('composer');
    await expect(composer).toBeVisible({ timeout: 20_000 });
    await composer.fill('Läs package.json och skapa src/hello.ts.');
    await composer.press('Control+Enter');

    await expect(page.getByTestId('message-assistant').last()).toContainText('Klart', {
      timeout: 60_000,
    });

    // Statusraden visar resultatet av den automatiska verifieringen.
    await expect(page.getByText(/verifiering: 3 av 3 steg gröna/)).toBeVisible({ timeout: 30_000 });

    // Panelen visar varje steg och rapporten från körningen.
    await page.getByRole('tab', { name: 'Verifiering' }).click();
    const pane = page.getByTestId('verification-pane');
    await expect(pane.getByTestId('verification-commands')).toContainText('Typkontroll');
    await expect(pane.getByTestId('verification-commands')).toContainText('Tester');

    const report = page.getByTestId('verification-report');
    await expect(report).toContainText('allt grönt');
    await expect(report).toContainText('3 av 3 steg gröna');
    await expect(report).toContainText('automatiskt efter körningen');
    await expect(report).toContainText('3 gröna');
    expect(pageErrors).toEqual([]);
  });
});
