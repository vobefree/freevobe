import type { BrowserDriver, BrowserSnapshot, BrowserScreenshot } from '@vibeforge/agent-core';

/**
 * Playwright-drivrutin. Laddas först när webbläsarautomation faktiskt används, eftersom
 * `playwright` är ett valfritt beroende (webbläsarna installeras separat med
 * `npx playwright install chromium`).
 */
export interface PlaywrightDriverOptions {
  headless?: boolean;
  timeoutMs?: number;
}

interface PlaywrightLike {
  chromium: { launch(options: { headless: boolean }): Promise<BrowserLike> };
}

interface BrowserLike {
  newContext(): Promise<ContextLike>;
  close(): Promise<void>;
}

interface ContextLike {
  newPage(): Promise<PageLike>;
  close(): Promise<void>;
}

interface PageLike {
  goto(url: string, options?: { waitUntil?: string; timeout?: number }): Promise<unknown>;
  title(): Promise<string>;
  url(): string;
  innerText(selector: string): Promise<string>;
  click(selector: string, options?: { timeout?: number }): Promise<void>;
  fill(selector: string, value: string): Promise<void>;
  press(selector: string, key: string): Promise<void>;
  screenshot(options: { fullPage?: boolean; type?: 'png' }): Promise<Buffer>;
  on(event: 'console', handler: (message: { type(): string; text(): string }) => void): void;
  close(): Promise<void>;
}

export class PlaywrightBrowserDriver implements BrowserDriver {
  private readonly options: PlaywrightDriverOptions;
  private browser: BrowserLike | null = null;
  private context: ContextLike | null = null;
  private page: PageLike | null = null;
  private readonly consoleErrors: string[] = [];

  constructor(options: PlaywrightDriverOptions = {}) {
    this.options = options;
  }

  private async ensurePage(): Promise<PageLike> {
    if (this.page) return this.page;

    let playwright: PlaywrightLike;
    try {
      playwright = (await import('playwright')) as unknown as PlaywrightLike;
    } catch {
      throw new Error(
        'Playwright är inte installerat. Kör "npm install playwright && npx playwright install chromium" för att kunna använda webbläsarautomation.',
      );
    }

    this.browser = await playwright.chromium.launch({ headless: this.options.headless ?? true });
    this.context = await this.browser.newContext();
    this.page = await this.context.newPage();
    this.page.on('console', (message) => {
      if (message.type() === 'error') {
        this.consoleErrors.push(message.text().slice(0, 500));
        if (this.consoleErrors.length > 20) this.consoleErrors.shift();
      }
    });
    return this.page;
  }

  private async snapshot(): Promise<BrowserSnapshot> {
    const page = await this.ensurePage();
    return {
      url: page.url(),
      title: await page.title().catch(() => ''),
      text: await this.readableText(page),
      ...(this.consoleErrors.length > 0 ? { consoleErrors: [...this.consoleErrors] } : {}),
    };
  }

  private async readableText(page: PageLike): Promise<string> {
    try {
      return (await page.innerText('body')).slice(0, 60_000);
    } catch {
      return '(kunde inte läsa sidans text)';
    }
  }

  async open(url: string): Promise<BrowserSnapshot> {
    const page = await this.ensurePage();
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: this.options.timeoutMs ?? 30_000,
    });
    return this.snapshot();
  }

  async read(): Promise<BrowserSnapshot> {
    return this.snapshot();
  }

  async screenshot(options: { fullPage?: boolean } = {}): Promise<BrowserScreenshot> {
    const page = await this.ensurePage();
    const buffer = await page.screenshot({ fullPage: options.fullPage ?? false, type: 'png' });
    return { base64: buffer.toString('base64'), mimeType: 'image/png' };
  }

  async click(selector: string): Promise<BrowserSnapshot> {
    const page = await this.ensurePage();
    await page.click(selector, { timeout: this.options.timeoutMs ?? 15_000 });
    await new Promise((resolve) => setTimeout(resolve, 200));
    return this.snapshot();
  }

  async fill(
    selector: string,
    value: string,
    options: { submit?: boolean } = {},
  ): Promise<BrowserSnapshot> {
    const page = await this.ensurePage();
    await page.fill(selector, value);
    if (options.submit) await page.press(selector, 'Enter');
    await new Promise((resolve) => setTimeout(resolve, 200));
    return this.snapshot();
  }

  async close(): Promise<void> {
    this.page = null;
    await this.context?.close().catch(() => undefined);
    this.context = null;
    await this.browser?.close().catch(() => undefined);
    this.browser = null;
  }
}

/** True om playwright-paketet går att importera. */
export async function playwrightAvailable(): Promise<boolean> {
  try {
    await import('playwright');
    return true;
  } catch {
    return false;
  }
}
