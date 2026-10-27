import { expect, test, type APIRequestContext } from '@playwright/test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const AGENT = 'http://127.0.0.1:4319';
const FAKE_OLLAMA = 'http://127.0.0.1:4399';
const MODEL = 'vibeforge-fake-coder:latest';

async function devToken(request: APIRequestContext): Promise<string> {
  const response = await request.get(`${AGENT}/api/dev-token`);
  const payload = (await response.json()) as { data: { token: string } };
  return payload.data.token;
}

/**
 * Gränssnittstestet kör hela kedjan i en riktig webbläsare mot den riktiga agenten och en
 * fejkad Ollama: onboarding → ny chatt → prompt → godkännande av diff → skriven fil.
 */
test.describe('Skrivbordsgränssnittet', () => {
  let projectRoot: string;
  let token: string;

  test.beforeAll(async ({ request }) => {
    token = await devToken(request);
    // Peka agenten mot den fejkade modellen så att testet inte kräver Ollama.
    await request.patch(`${AGENT}/api/settings`, {
      headers: { 'x-vibeforge-token': token },
      data: { ollamaBaseUrl: FAKE_OLLAMA, defaultModel: MODEL, permissionMode: 'ask' },
    });

    projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'vibeforge-ui-'));
    await fs.mkdir(path.join(projectRoot, 'src'), { recursive: true });
    await fs.writeFile(
      path.join(projectRoot, 'package.json'),
      JSON.stringify({ name: 'ui-projekt' }, null, 2),
    );
    await fs.writeFile(
      path.join(projectRoot, 'src', 'app.ts'),
      'export const start = () => "hej";\n',
    );
  });

  test.afterAll(async () => {
    await fs.rm(projectRoot, { recursive: true, force: true }).catch(() => undefined);
  });

  test('onboarding, chatt, godkännande och diff', async ({ page }) => {
    await page.goto('/');

    // ---- Onboarding
    const onboarding = page.getByTestId('onboarding');
    await expect(onboarding).toBeVisible();
    await expect(onboarding).toContainText('Så fungerar det');

    const consent = page.getByTestId('consent-local');
    await consent.check();
    await page.getByTestId('onboarding-next').click();

    // ---- Ollama-steget visar den fejkade modellen
    await expect(onboarding).toContainText('Anslut Ollama');
    await expect(onboarding).toContainText('vibeforge-fake-coder:latest');
    await expect(onboarding).toContainText('tool calling');
    await page.getByTestId('onboarding-next').click();

    // ---- Projektmappen
    await expect(onboarding).toContainText('Välj projekt');
    await page.getByTestId('project-path').fill(projectRoot);
    await page.getByTestId('onboarding-next').click();

    // ---- Annonser stängs av (standard) och onboarding avslutas
    await expect(onboarding).toContainText('Annonsplats i chatten');
    await page.getByTestId('onboarding-next').click();
    await expect(onboarding).toContainText('Klart att smida');
    await page.getByTestId('onboarding-finish').click();

    // ---- Arbetsytan (vänsterpanelen syns direkt, chatten kräver en session)
    await expect(page.getByTestId('new-session')).toBeVisible();

    // Ingen annonsplats när användaren inte samtyckt.
    await expect(page.locator('[data-testid="ad-slot"]')).toHaveCount(0);

    // ---- Ny chatt
    await page.getByTestId('new-session').click();
    await expect(page.getByTestId('composer')).toBeVisible({ timeout: 15_000 });

    // ---- Skicka en prompt (Ctrl+Enter)
    const composer = page.getByTestId('composer');
    await composer.fill('Läs package.json och skapa src/hello.ts.');
    await composer.press('Control+Enter');
    await expect(page.getByTestId('message-user').first()).toContainText('Läs package.json');

    // ---- Godkännandet: diffen visas innan filen skrivs
    const approvalCard = page.getByTestId('approval-card');
    await expect(approvalCard).toBeVisible({ timeout: 45_000 });
    await expect(approvalCard).toContainText('src/hello.ts');
    await expect(approvalCard).toContainText('export const hello');

    await approvalCard.getByTestId('approve').click();
    await expect(approvalCard).toBeHidden({ timeout: 30_000 });

    // ---- Filen skrevs och agenten svarade
    await expect
      .poll(
        async () => fs.readFile(path.join(projectRoot, 'src', 'hello.ts'), 'utf8').catch(() => ''),
        {
          timeout: 30_000,
        },
      )
      .toContain('vibeforge');

    await expect(page.getByTestId('message-assistant').last()).toContainText('Klart', {
      timeout: 30_000,
    });

    // ---- Diffen ligger kvar i högerpanelen
    await expect(page.getByText('src/hello.ts').first()).toBeVisible();

    // ---- Kommandopaletten
    await page.keyboard.press('Control+k');
    await expect(page.getByTestId('command-palette')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('command-palette')).toBeHidden();
  });

  test('visar fel och hjälp när agenten inte svarar', async ({ page }) => {
    // Simulerar att agent-backenden är nere genom att svara med ett transportfel.
    await page.route('**/api/health', (route) => route.abort('failed'));
    await page.goto('/');
    await expect(page.getByText('VibeForge-agenten svarar inte')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Öppna hjälp' })).toBeVisible();
  });
});
