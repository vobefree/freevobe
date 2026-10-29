import { expect, test, type APIRequestContext } from '@playwright/test';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { AGENT, FAKE_OLLAMA, MODEL } from './fixtures/env';

async function devToken(request: APIRequestContext): Promise<string> {
  const response = await request.get(`${AGENT}/api/dev-token`);
  const payload = (await response.json()) as { data: { token: string } };
  return payload.data.token;
}

/** Kör git i testprojektet och returnerar stdout. */
async function git(cwd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('git', args, { cwd, windowsHide: true }, (error, stdout) =>
      error ? reject(error) : resolve(stdout),
    );
  });
}

/** Gör testprojektet till ett Git-repo med en första commit, utan globala git-inställningar. */
async function initGitRepo(cwd: string): Promise<void> {
  await git(cwd, ['init']);
  await git(cwd, ['config', 'user.email', 'test@freevobe.dev']);
  await git(cwd, ['config', 'user.name', 'Freevobe Test']);
  await git(cwd, ['add', '.']);
  await git(cwd, ['commit', '-m', 'Första commit']);
}

/**
 * Checkpoints i en riktig webbläsare: tidslinjen, diffen, konfliktskyddet och den tvingade
 * återställningen. Kör mot den riktiga agenten med fejkad Ollama, så hela kedjan
 * prompt → godkännande → skrivning → checkpoint → återställning verifieras utan en modell.
 */
test.describe('Checkpoints i gränssnittet', () => {
  let projectRoot: string;
  let token: string;
  const helloFile = () => path.join(projectRoot, 'src', 'hello.ts');

  test.beforeAll(async ({ request }) => {
    token = await devToken(request);
    await request.patch(`${AGENT}/api/settings`, {
      headers: { 'x-freevobe-token': token },
      data: { ollamaBaseUrl: FAKE_OLLAMA, defaultModel: MODEL, permissionMode: 'ask' },
    });

    projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'freevobe-checkpoints-'));
    await fs.mkdir(path.join(projectRoot, 'src'), { recursive: true });
    await fs.writeFile(
      path.join(projectRoot, 'package.json'),
      JSON.stringify({ name: 'checkpoint-projekt', private: true }, null, 2),
    );
  });

  test.afterAll(async () => {
    await fs.rm(projectRoot, { recursive: true, force: true }).catch(() => undefined);
  });

  test('sparar en checkpoint, visar diffen och kräver bekräftelse vid konflikt', async ({
    page,
  }) => {
    // Onboarding är redan avklarad – testet handlar om checkpoints, inte om första starten.
    await page.addInitScript(() => {
      window.localStorage.setItem('freevobe.onboardingComplete', '1');
    });

    await page.goto('/');
    await page.getByTestId('open-project-path').fill(projectRoot);
    await page.getByTestId('open-project').click();
    await expect(page.getByText('package.json').first()).toBeVisible({ timeout: 20_000 });

    // ---- En agentkörning som skapar en fil: det är den som ger checkpointen
    await page.getByTestId('new-session').click();
    const composer = page.getByTestId('composer');
    await expect(composer).toBeVisible({ timeout: 20_000 });
    await composer.fill('Läs package.json och skapa src/hello.ts.');
    await composer.press('Control+Enter');

    const approvalCard = page.getByTestId('approval-card');
    await expect(approvalCard).toBeVisible({ timeout: 45_000 });
    await expect(approvalCard).toContainText('src/hello.ts');
    await approvalCard.getByTestId('approve').click();
    await expect(approvalCard).toBeHidden({ timeout: 30_000 });

    await expect(page.getByTestId('message-assistant').last()).toContainText('Klart', {
      timeout: 45_000,
    });
    await expect
      .poll(async () => fs.readFile(helloFile(), 'utf8').catch(() => ''), {
        timeout: 30_000,
      })
      .toContain('freevobe');

    // ---- Tidslinjen: kortet visar etikett, fil och status
    await page.getByRole('tab', { name: /Checkpoints/ }).click();
    const card = page.getByTestId('checkpoint-item').first();
    await expect(card).toBeVisible({ timeout: 30_000 });
    await expect(card).toContainText('Läs package.json och skapa src/hello.ts.');
    await expect(card).toContainText('src/hello.ts');
    await expect(card).toContainText('Öppen');

    // ---- Diffen öppnas i Diff-fliken och visar den skapade filen
    await card.getByTestId('checkpoint-diff').click();
    await expect(page.getByText('Diffen är oföränderlig').first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('export const hello').first()).toBeVisible();

    // ---- Någon ändrar filen efter checkpointen: då får den inte skrivas över tyst
    await fs.appendFile(helloFile(), 'export const senare = true;\n');

    await page.getByRole('tab', { name: /Checkpoints/ }).click();
    await page.getByTestId('checkpoint-restore').first().click();
    await page.getByTestId('checkpoint-confirm-restore').click();

    const conflicts = page.getByTestId('checkpoint-conflicts');
    await expect(conflicts).toBeVisible({ timeout: 20_000 });
    await expect(conflicts).toContainText('src/hello.ts');
    // Filen är orörd: konfliktskyddet skrev inte över det nyare arbetet.
    expect(await fs.readFile(helloFile(), 'utf8')).toContain('senare');

    // ---- Tvingad återställning kräver ett extra steg och tar bort den skapade filen
    await page.getByTestId('checkpoint-force').click();
    await page.getByTestId('checkpoint-confirm-force').click();

    await expect
      .poll(async () => fs.readFile(helloFile(), 'utf8').catch(() => null), {
        timeout: 20_000,
      })
      .toBeNull();
    await expect(conflicts).toBeHidden({ timeout: 20_000 });
    await expect(page.getByTestId('checkpoint-item').first()).toContainText('Återställd');
  });
});

/**
 * Committa-knappen: checkpointen ska skapa en riktig Git-commit av sina filer, och kortet ska visa
 * commit-hashen. Kör mot ett vanligt Git-repo så att inget behöver fejkas.
 */
test.describe('Committa en checkpoint', () => {
  let projectRoot: string;
  const halsaFile = () => path.join(projectRoot, 'src', 'halsa.ts');

  test.beforeAll(async ({ request }) => {
    const token = await devToken(request);
    await request.patch(`${AGENT}/api/settings`, {
      headers: { 'x-freevobe-token': token },
      data: { ollamaBaseUrl: FAKE_OLLAMA, defaultModel: MODEL, permissionMode: 'ask' },
    });

    projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'freevobe-commit-'));
    await fs.mkdir(path.join(projectRoot, 'src'), { recursive: true });
    await fs.writeFile(
      path.join(projectRoot, 'package.json'),
      JSON.stringify({ name: 'commit-projekt', private: true }, null, 2),
    );
    await fs.writeFile(halsaFile(), "export const halsa = 'hej';\n");
    await initGitRepo(projectRoot);
  });

  test.afterAll(async () => {
    await fs.rm(projectRoot, { recursive: true, force: true }).catch(() => undefined);
  });

  test('skapar en riktig Git-commit av checkpointens filer', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('freevobe.onboardingComplete', '1');
    });

    await page.goto('/');
    await page.getByTestId('open-project-path').fill(projectRoot);
    await page.getByTestId('open-project').click();
    await expect(page.getByText('package.json').first()).toBeVisible({ timeout: 20_000 });

    // ---- En ocommittad ändring i arbetskopian blir en manuell checkpoint
    await fs.writeFile(halsaFile(), "export const halsa = 'hej från Freevobe';\n");
    await page.getByRole('tab', { name: /Checkpoints/ }).click();
    await page.getByTestId('new-checkpoint').click();

    const card = page.getByTestId('checkpoint-item').first();
    await expect(card).toBeVisible({ timeout: 20_000 });
    await expect(card).toContainText('src/halsa.ts');
    await expect(card).toContainText('manuell');

    // ---- Committa med eget meddelande
    await card.getByTestId('checkpoint-commit').click();
    const input = card.getByTestId('checkpoint-commit-input');
    await expect(input).toBeVisible();
    await input.fill('Checkpoint: hälsningen');
    await card.getByTestId('checkpoint-commit-send').click();

    // ---- Kortet blir committat och visar hashen
    await expect(card).toContainText('Committad', { timeout: 20_000 });
    await expect(card).toContainText('commit');

    // ---- Committen finns i Git-historiken och filen ligger i den
    await expect
      .poll(async () => (await git(projectRoot, ['log', '-1', '--pretty=%s'])).trim(), {
        timeout: 20_000,
      })
      .toBe('Checkpoint: hälsningen');
    const committed = await git(projectRoot, ['show', '--name-only', '--pretty=format:', 'HEAD']);
    expect(committed).toContain('src/halsa.ts');

    // ---- Inget ligger kvar som ändrat i arbetskopian
    const status = await git(projectRoot, ['status', '--short']);
    expect(status).not.toContain('src/halsa.ts');
  });
});
