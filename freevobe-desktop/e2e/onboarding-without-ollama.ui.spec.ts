import { expect, test } from '@playwright/test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

/**
 * En ny installation har ofta ingen Ollama ännu. Appen ska gå att starta, öppna ett projekt i och
 * titta runt i ändå: chatten väntar på en modell, men arbetsytan ska synas.
 *
 * Ollama-svaret stubbas i webbläsaren, så testet varken kräver eller rör en riktig
 * Ollama-installation på maskinen.
 */
test.describe('Onboarding utan Ollama', () => {
  test('går att hoppa över Ollama och titta runt i appen', async ({ page }) => {
    const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'freevobe-utan-ollama-'));
    await fs.writeFile(
      path.join(projectRoot, 'package.json'),
      JSON.stringify({ name: 'utan-ollama' }, null, 2),
    );

    try {
      await page.route('**/api/ollama*', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: {
              available: false,
              baseUrl: 'http://localhost:11434',
              models: [],
              error: 'Ollama svarar inte på localhost:11434.',
              helpUrl: 'https://freevobe.dev/docs/ollama',
            },
          }),
        }),
      );

      await page.goto('/');

      const onboarding = page.getByTestId('onboarding');
      await expect(onboarding).toBeVisible();
      await expect(onboarding).toContainText('Freevobe');

      await page.getByTestId('consent-local').check();
      await page.getByTestId('onboarding-next').click();

      // ---- Ollama saknas: hjälp, förklaring och en väg vidare
      await expect(page.getByText('Anslut Ollama')).toBeVisible();
      await expect(page.getByText(/Ollama svarar inte/)).toBeVisible();
      await expect(page.getByText(/Du kan hoppa över det här steget/)).toBeVisible();

      await page.getByTestId('onboarding-skip-ollama').click();
      await expect(page.getByText('Välj projekt')).toBeVisible();

      // ---- Hoppa över projekt och Gives Back, starta appen
      await page.getByTestId('onboarding-next').click();
      await expect(page.getByText('Freevobe Gives Back')).toBeVisible();
      await page.getByTestId('onboarding-next').click();
      await page.getByTestId('onboarding-finish').click();

      // ---- Arbetsytan syns direkt, med rätt namn i toppraden
      const banner = page.getByRole('banner');
      const projectPathInput = page.getByTestId('open-project-path');
      await expect(projectPathInput).toBeVisible();
      await expect(banner.getByText('Freevobe')).toBeVisible();

      // ---- Ett projekt går att öppna utan modell, och chatten går att titta på
      await projectPathInput.fill(projectRoot);
      await projectPathInput.press('Enter');
      await expect(banner).toContainText(path.basename(projectRoot), { timeout: 30_000 });

      await page.getByTestId('new-session').click();
      await expect(page.getByTestId('composer')).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText('Vad ska vi smida idag?')).toBeVisible();

      await page.screenshot({ path: 'test-results/utan-ollama.png' });
    } finally {
      await fs.rm(projectRoot, { recursive: true, force: true }).catch(() => undefined);
    }
  });
});
