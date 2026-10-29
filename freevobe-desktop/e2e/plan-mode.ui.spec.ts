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
 * Plan/Act i en riktig webbläsare: agenten lägger fram en plan i Plan-läget, ingenting skrivs
 * förrän användaren klickat, och godkännandet gör planen till ett kontrakt i Execute-läget.
 */
test.describe('Plan/Act', () => {
  let projectRoot: string;
  let token: string;

  test.beforeAll(async ({ request }) => {
    token = await devToken(request);
    await request.patch(`${AGENT}/api/settings`, {
      headers: { 'x-freevobe-token': token },
      data: { ollamaBaseUrl: FAKE_OLLAMA, defaultModel: MODEL, permissionMode: 'auto-edit' },
    });

    projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'freevobe-plan-'));
    await fs.mkdir(path.join(projectRoot, 'src'), { recursive: true });
    await fs.writeFile(
      path.join(projectRoot, 'package.json'),
      JSON.stringify({ name: 'planprojekt', private: true }, null, 2),
    );
  });

  test.afterAll(async () => {
    await fs.rm(projectRoot, { recursive: true, force: true }).catch(() => undefined);
  });

  test('planen godkänns innan agenten får skriva', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('freevobe.onboardingComplete', '1');
    });

    await page.goto('/');
    await page.getByTestId('open-project-path').fill(projectRoot);
    await page.getByTestId('open-project').click();
    await expect(page.getByText('package.json').first()).toBeVisible({ timeout: 20_000 });

    // Auto-redigera så att det är planen, inte behörighetsläget, som avgör skrivningen.
    await page.getByTestId('permission-mode').selectOption('auto-edit');

    // ---- Plan-läget
    await page.getByRole('button', { name: 'Plan-läge' }).click();
    await page.getByTestId('new-session').click();
    const composer = page.getByTestId('composer');
    await expect(composer).toBeVisible({ timeout: 20_000 });
    await composer.fill('Föreslå en plan för att skapa src/hello.ts.');
    await composer.press('Control+Enter');

    // ---- Planen visas som ett kontrakt, utan att något skrivs
    const planCard = page.getByTestId('plan-card');
    await expect(planCard).toBeVisible({ timeout: 45_000 });
    await expect(planCard.getByTestId('plan-title')).toHaveText('Skapa src/hello.ts');
    await expect(planCard.getByTestId('plan-steps')).toContainText('Skriv src/hello.ts');
    await expect(planCard).toContainText('Kontrakt: 1 fil');
    await expect(page.getByTestId('approval-card')).toHaveCount(0);
    await expect
      .poll(async () =>
        fs.readFile(path.join(projectRoot, 'src', 'hello.ts'), 'utf8').catch(() => ''),
      )
      .toBe('');

    // ---- Godkännande: planen blir kontrakt och agenten utför den
    await planCard.getByTestId('approve-plan').click();

    await expect(planCard).toContainText('Godkänd – gäller som kontrakt', { timeout: 30_000 });
    await expect(page.getByTestId('message-assistant').last()).toContainText('Klart', {
      timeout: 45_000,
    });
    await expect(page.getByTestId('approval-card')).toHaveCount(0);
    await expect
      .poll(
        async () => fs.readFile(path.join(projectRoot, 'src', 'hello.ts'), 'utf8').catch(() => ''),
        { timeout: 20_000 },
      )
      .toContain('freevobe');
    await expect(page.getByText('plan godkänd')).toBeVisible();
  });
});
