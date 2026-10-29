import { expect, test, type APIRequestContext } from '@playwright/test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { DEFAULT_AUTO_APPROVE } from '@freevobe/protocol';
import { AGENT, FAKE_OLLAMA, MODEL } from './fixtures/env';

async function devToken(request: APIRequestContext): Promise<string> {
  const response = await request.get(`${AGENT}/api/dev-token`);
  const payload = (await response.json()) as { data: { token: string } };
  return payload.data.token;
}

/**
 * Auto-godkännande per kategori i en riktig webbläsare. Behörighetsläget är kvar på
 * "Fråga alltid" hela tiden – det är bara kategorin som avgör om agenten måste fråga.
 */
test.describe('Auto-godkännande per kategori', () => {
  let projectRoot: string;
  let token: string;

  test.beforeAll(async ({ request }) => {
    token = await devToken(request);
    await request.patch(`${AGENT}/api/settings`, {
      headers: { 'x-freevobe-token': token },
      data: { ollamaBaseUrl: FAKE_OLLAMA, defaultModel: MODEL, permissionMode: 'ask' },
    });

    projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'freevobe-autoapprove-'));
    await fs.mkdir(path.join(projectRoot, 'src'), { recursive: true });
    await fs.writeFile(
      path.join(projectRoot, 'package.json'),
      JSON.stringify({ name: 'autoapprove-projekt', private: true }, null, 2),
    );
  });

  test.afterAll(async () => {
    await request_restore_settings();
    await fs.rm(projectRoot, { recursive: true, force: true }).catch(() => undefined);
  });

  async function request_restore_settings(): Promise<void> {
    await fetch(`${AGENT}/api/settings`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'x-freevobe-token': token },
      body: JSON.stringify({ autoApprove: DEFAULT_AUTO_APPROVE }),
    });
  }

  test('skriver filer utan godkännandekort när filändringar är auto-godkända', async ({ page }) => {
    await fetch(`${AGENT}/api/settings`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'x-freevobe-token': token },
      body: JSON.stringify({ autoApprove: { ...DEFAULT_AUTO_APPROVE, file_write: true } }),
    });

    await page.addInitScript(() => {
      window.localStorage.setItem('freevobe.onboardingComplete', '1');
    });

    await page.goto('/');
    await page.getByTestId('open-project-path').fill(projectRoot);
    await page.getByTestId('open-project').click();
    await expect(page.getByText('package.json').first()).toBeVisible({ timeout: 20_000 });

    // ---- Inställningarna visar vad som är på, och panelen sammanfattar det
    await expect(page.getByTestId('auto-approve-chips')).toContainText('Filändringar');
    await page.getByRole('button', { name: '⚙' }).click();
    const settings = page.getByTestId('auto-approve-settings');
    await expect(settings).toBeVisible();
    await expect(page.getByTestId('auto-approve-file_write')).toBeChecked();
    await expect(page.getByTestId('auto-approve-command')).not.toBeChecked();
    await page.getByRole('button', { name: 'Stäng' }).click();

    // ---- Körningen skriver filen utan att något godkännandekort dyker upp
    await page.getByTestId('new-session').click();
    const composer = page.getByTestId('composer');
    await expect(composer).toBeVisible({ timeout: 20_000 });
    await composer.fill('Läs package.json och skapa src/hello.ts.');
    await composer.press('Control+Enter');

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
  });

  test('frågar igen när kategorin slås av', async ({ page }) => {
    await request_restore_settings();

    await page.addInitScript(() => {
      window.localStorage.setItem('freevobe.onboardingComplete', '1');
    });

    await page.goto('/');
    await page.getByTestId('open-project-path').fill(projectRoot);
    await page.getByTestId('open-project').click();
    await expect(page.getByText('package.json').first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('auto-approve-chips')).toHaveCount(0);

    await page.getByTestId('new-session').click();
    const composer = page.getByTestId('composer');
    await expect(composer).toBeVisible({ timeout: 20_000 });
    await composer.fill('Läs package.json och skapa src/hello.ts igen.');
    await composer.press('Control+Enter');

    const approvalCard = page.getByTestId('approval-card');
    await expect(approvalCard).toBeVisible({ timeout: 45_000 });
    await expect(approvalCard).toContainText('src/hello.ts');
    await approvalCard.getByTestId('approve').click();
    await expect(approvalCard).toBeHidden({ timeout: 30_000 });
  });
});
