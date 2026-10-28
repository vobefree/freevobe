import { expect, test } from '@playwright/test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

/**
 * Offline-löftet: editorn får aldrig hämta Monaco från ett CDN. `@monaco-editor/react` gör det
 * som standard, så testet öppnar en riktig fil i den riktiga appen och misslyckas om webbläsaren
 * över huvud taget rör nätet utanför datorn.
 */
test.describe('Editorn är helt lokal', () => {
  let projectRoot: string;

  test.beforeAll(async () => {
    projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'vibeforge-offline-'));
    await fs.mkdir(path.join(projectRoot, 'src'), { recursive: true });
    await fs.writeFile(
      path.join(projectRoot, 'package.json'),
      JSON.stringify({ name: 'offline-projekt', private: true }, null, 2),
    );
    await fs.writeFile(
      path.join(projectRoot, 'src', 'app.ts'),
      'export const start = () => "hej";\n',
    );
  });

  test.afterAll(async () => {
    await fs.rm(projectRoot, { recursive: true, force: true }).catch(() => undefined);
  });

  test('laddar Monaco från den lokala bundlen – inga CDN-anrop', async ({ page }) => {
    const external: string[] = [];
    page.on('request', (request) => {
      const url = new URL(request.url());
      const isLocal =
        ['127.0.0.1', 'localhost', '::1'].includes(url.hostname) ||
        ['data:', 'blob:', 'file:'].includes(url.protocol);
      if (!isLocal) external.push(`${request.method()} ${request.url()}`);
    });

    // Onboarding är redan avklarad i testet – här handlar allt om editorn.
    await page.addInitScript(() => {
      window.localStorage.setItem('vibeforge.onboardingComplete', '1');
    });

    await page.goto('/');
    await page.getByTestId('open-project-path').fill(projectRoot);
    await page.getByTestId('open-project').click();

    await page.getByRole('button', { name: 'src/app.ts', exact: true }).click();
    await expect(page.locator('.monaco-editor')).toBeVisible({ timeout: 30_000 });

    // Freevobe-temat (#14161c) finns bara i vår egen Monaco-instans.
    await expect(page.locator('.lines-content.monaco-editor-background')).toHaveCSS(
      'background-color',
      'rgb(20, 22, 28)',
    );
    await expect(page.locator('.view-line').first()).toContainText('export const start');

    expect(external, `Editorn hämtade resurser utanför datorn:\n${external.join('\n')}`).toEqual(
      [],
    );
  });
});
