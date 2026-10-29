import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { AGENT, FAKE_OLLAMA, MODEL } from './fixtures/env';

/**
 * Gives Back i en riktig webbläsare mot den riktiga agent-servern.
 *
 * Testet rör aldrig en betalning: det kontrollerar att platsen är frivillig, att den bara får
 * ett tal, att länken går till organisationen och att det användaren själv registrerar hamnar i
 * den lokala loggen och kan raderas.
 */

interface Contribution {
  id: string;
  causeId: string;
  amountSek: number;
  note?: string;
}

async function devToken(request: APIRequestContext): Promise<string> {
  const response = await request.get(`${AGENT}/api/dev-token`);
  const payload = (await response.json()) as { data: { token: string } };
  return payload.data.token;
}

test.describe('Gives Back', () => {
  let projectRoot: string;
  let token: string;

  async function request(
    pathname: string,
    options: { method?: string; body?: unknown } = {},
  ): Promise<any> {
    const response = await fetch(`${AGENT}${pathname}`, {
      method: options.method ?? 'GET',
      headers: { 'content-type': 'application/json', 'x-freevobe-token': token },
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    });
    const payload = (await response.json()) as { data?: any };
    return payload.data;
  }

  async function clearEntries(): Promise<void> {
    const entries = (await request('/api/gives-back'))?.entries ?? [];
    for (const entry of entries as Contribution[]) {
      await request(`/api/gives-back/${entry.id}`, { method: 'DELETE' });
    }
  }

  test.beforeAll(async ({ request: apiRequest }) => {
    token = await devToken(apiRequest);
    await clearEntries();
    await request('/api/settings', {
      method: 'PATCH',
      body: {
        ollamaBaseUrl: FAKE_OLLAMA,
        defaultModel: MODEL,
        permissionMode: 'auto-edit',
        givesBack: {
          enabled: true,
          everyNPrompts: 1,
          causeIds: ['wwf'],
          consentedAt: Date.now(),
        },
      },
    });

    projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'freevobe-givesback-'));
    await fs.writeFile(
      path.join(projectRoot, 'package.json'),
      JSON.stringify({ name: 'gives-back-projekt', private: true }, null, 2),
    );
  });

  test.afterAll(async () => {
    await request('/api/settings', {
      method: 'PATCH',
      body: { givesBack: { enabled: false, everyNPrompts: 10, causeIds: [] } },
    });
    await clearEntries();
    await fs.rm(projectRoot, { recursive: true, force: true }).catch(() => undefined);
  });

  async function openProject(page: Page): Promise<void> {
    await page.addInitScript(() => {
      window.localStorage.setItem('freevobe.onboardingComplete', '1');
    });
    await page.goto('/');
    await page.getByTestId('open-project-path').fill(projectRoot);
    await page.getByTestId('open-project').click();
    await expect(page.getByText('package.json').first()).toBeVisible({ timeout: 20_000 });
  }

  test('panelen registrerar ett eget stöd och raderar det', async ({ page }) => {
    await openProject(page);

    // Statusfältet visar att platsen är på och att loggen är tom.
    const status = page.getByTitle('Öppna Gives Back');
    await expect(status).toContainText('gives back: på');
    await status.click();

    await expect(page.getByText('Ändamål i rotationen')).toBeVisible();
    await expect(page.getByText(/Freevobe tar inte emot pengar/)).toBeVisible();

    await page.getByTestId('gives-back-cause').selectOption('wwf');
    await page.getByTestId('gives-back-pane-amount').fill('250');
    await page.getByTestId('gives-back-pane-note').fill('E2E-skog');
    await page.getByRole('button', { name: 'Spara' }).click();

    const row = page.getByTestId('contribution-row').first();
    await expect(row).toContainText('WWF');
    await expect(row).toContainText('250');
    await expect(row).toContainText('E2E-skog');
    await expect(row).toContainText('egen rapportering');
    await expect(page.getByTestId('gives-back-summary')).toContainText('1 stöd · 250 kr');
    await expect(page.getByTitle('Öppna Gives Back')).toContainText('1 stöd · 250 kr');

    await row.getByRole('button', { name: 'Ta bort' }).click();
    await expect(page.getByTestId('contribution-row')).toHaveCount(0);
    await expect(page.getByText('Ingen logg än', { exact: true })).toBeVisible();
    await expect(page.getByTestId('gives-back-summary')).toContainText('0 stöd · 0 kr');
  });

  test('kortet i chatten länkar ut och loggar det användaren själv uppger', async ({ page }) => {
    await openProject(page);

    await page.getByTestId('new-session').click();
    const composer = page.getByTestId('composer');
    await expect(composer).toBeVisible({ timeout: 20_000 });
    await composer.fill('Skapa en hälsning i src/hello.ts.');
    await composer.press('Control+Enter');

    // Körningen stannar på godkännandet av filskrivningen; platsen renderas mellan meddelanden
    // och syns därför först när turen är klar.
    const approval = page.getByTestId('approval-card');
    await expect(approval).toBeVisible({ timeout: 45_000 });
    await approval.getByTestId('approve').click();

    const card = page.getByTestId('gives-back-card').first();
    await expect(card).toBeVisible({ timeout: 45_000 });
    await expect(card).toContainText('Gives Back');
    await expect(card).toContainText('inga pengar går genom Freevobe');
    await expect(card).toContainText('WWF');

    const link = card.getByTestId('gives-back-open');
    await expect(link).toHaveAttribute('href', 'https://www.wwf.se');
    await expect(link).toHaveAttribute('rel', /noopener/);
    await expect(link).toHaveAttribute('target', '_blank');

    await card.getByTestId('gives-back-log').click();
    await card.getByTestId('gives-back-amount').fill('100');
    await card.getByTestId('gives-back-submit').click();
    await expect(card.getByTestId('gives-back-saved')).toBeVisible();

    // Loggen är verklig: raden finns kvar i databasen och syns i panelen.
    const entries = (await request('/api/gives-back'))?.entries ?? [];
    expect((entries as Contribution[])[0]).toMatchObject({ causeId: 'wwf', amountSek: 100 });

    await page.getByTitle('Öppna Gives Back').click();
    await expect(page.getByTestId('contribution-row').first()).toContainText('100');
    await expect(page.getByTestId('gives-back-summary')).toContainText('1 stöd · 100 kr');
  });
});
