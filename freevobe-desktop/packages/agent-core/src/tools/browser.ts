import fs from 'node:fs/promises';
import path from 'node:path';
import { truncate } from '../util/text.js';
import { fail, numberArg, ok, stringArg, type RegisteredTool, type ToolContext } from './types.js';

export interface BrowserSnapshot {
  url: string;
  title: string;
  text: string;
  consoleErrors?: string[];
}

export interface BrowserScreenshot {
  base64: string;
  mimeType: string;
}

/**
 * Drivrutinen injiceras från agent-servern (Playwright). Kärnan håller sig därmed
 * beroendefri och testbar utan webbläsare.
 */
export interface BrowserDriver {
  open(url: string): Promise<BrowserSnapshot>;
  read(): Promise<BrowserSnapshot>;
  screenshot(options?: { fullPage?: boolean }): Promise<BrowserScreenshot>;
  click(selector: string): Promise<BrowserSnapshot>;
  fill(selector: string, value: string, options?: { submit?: boolean }): Promise<BrowserSnapshot>;
  close(): Promise<void>;
}

function requireBrowser(ctx: ToolContext): BrowserDriver | null {
  return ctx.browser ?? null;
}

async function confirmBrowserAction(
  ctx: ToolContext,
  action: string,
  detail: string,
  extra: { url?: string } = {},
): Promise<string | null> {
  const outcome = await ctx.requestApproval({
    kind: 'browser',
    title: `Webbläsare: ${action}`,
    detail,
    reason:
      ctx.approval.reason && ctx.approval.reason !== 'Tillåtet.'
        ? ctx.approval.reason
        : 'Webbläsarautomation kräver alltid ditt godkännande.',
    risk: ctx.approval.risk,
    hardBlock: true,
    ...extra,
  });
  return outcome.approved ? null : `Användaren avvisade åtgärden: ${action}.`;
}

export async function saveScreenshot(
  root: string,
  base64: string,
  label = 'browser',
): Promise<string> {
  const directory = path.join(root, '.freevobe', 'workspace', 'screenshots');
  await fs.mkdir(directory, { recursive: true });
  const fileName = `${label}-${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
  const absolute = path.join(directory, fileName);
  await fs.writeFile(absolute, Buffer.from(base64, 'base64'));
  return path.relative(root, absolute).replace(/\\/g, '/');
}

export const browserOpenTool: RegisteredTool = {
  spec: {
    name: 'browser_open',
    description: 'Öppnar en webbsida i en kontrollerad webbläsare och returnerar sidans text.',
    parameters: {
      type: 'object',
      properties: { url: { type: 'string', description: 'http(s)-adress.' } },
      required: ['url'],
    },
    danger: 'network',
    source: 'builtin',
  },
  handler: async (args, ctx) => {
    const url = stringArg(args, 'url');
    if (!url) return fail('Argumentet "url" saknas.');
    const driver = requireBrowser(ctx);
    if (!driver)
      return fail(
        'Ingen webbläsardrivrutin är installerad. Kör "npx playwright install chromium".',
      );

    const rejected = await confirmBrowserAction(ctx, 'öppna sida', url, { url });
    if (rejected) return fail(rejected);

    try {
      const snapshot = await driver.open(url);
      return ok(describeSnapshot(snapshot), { url: snapshot.url, title: snapshot.title });
    } catch (error) {
      return fail(
        `Kunde inte öppna ${url}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  },
};

export const browserReadTool: RegisteredTool = {
  spec: {
    name: 'browser_read',
    description: 'Läser texten på den sida som är öppen i webbläsaren.',
    parameters: {
      type: 'object',
      properties: {
        maxChars: { type: 'integer', description: 'Max antal tecken.', default: 20000 },
      },
    },
    danger: 'network',
    source: 'builtin',
  },
  handler: async (args, ctx) => {
    const driver = requireBrowser(ctx);
    if (!driver) return fail('Ingen webbläsardrivrutin är installerad.');
    try {
      const snapshot = await driver.read();
      const maxChars = Math.min(numberArg(args, 'maxChars', 20_000), 100_000);
      return ok(describeSnapshot(snapshot, maxChars), { url: snapshot.url, title: snapshot.title });
    } catch (error) {
      return fail(
        `Kunde inte läsa sidan: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  },
};

export const browserScreenshotTool: RegisteredTool = {
  spec: {
    name: 'browser_screenshot',
    description: 'Tar en skärmbild av den öppna sidan och sparar den i projektets workspace-mapp.',
    parameters: {
      type: 'object',
      properties: {
        fullPage: { type: 'boolean', description: 'Ta hela sidan, inte bara vyn.', default: false },
        label: { type: 'string', description: 'Etikett i filnamnet.', default: 'browser' },
      },
    },
    danger: 'network',
    source: 'builtin',
  },
  handler: async (args, ctx) => {
    const driver = requireBrowser(ctx);
    if (!driver) return fail('Ingen webbläsardrivrutin är installerad.');

    const rejected = await confirmBrowserAction(
      ctx,
      'skärmdump',
      args.fullPage === true ? 'hela sidan' : 'synlig vy',
    );
    if (rejected) return fail(rejected);

    try {
      const shot = await driver.screenshot({ fullPage: args.fullPage === true });
      const saved = await saveScreenshot(
        ctx.root,
        shot.base64,
        stringArg(args, 'label') ?? 'browser',
      );
      return ok(`Skärmbild sparad: ${saved}`, { path: saved });
    } catch (error) {
      return fail(
        `Kunde inte ta skärmdump: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  },
};

export const browserClickTool: RegisteredTool = {
  spec: {
    name: 'browser_click',
    description: 'Klickar på ett element på den öppna sidan.',
    parameters: {
      type: 'object',
      properties: { selector: { type: 'string', description: 'CSS-selektor eller text=...' } },
      required: ['selector'],
    },
    danger: 'network',
    source: 'builtin',
  },
  handler: async (args, ctx) => {
    const selector = stringArg(args, 'selector');
    if (!selector) return fail('Argumentet "selector" saknas.');
    const driver = requireBrowser(ctx);
    if (!driver) return fail('Ingen webbläsardrivrutin är installerad.');

    const rejected = await confirmBrowserAction(ctx, 'klicka', selector);
    if (rejected) return fail(rejected);

    try {
      const snapshot = await driver.click(selector);
      return ok(describeSnapshot(snapshot), { url: snapshot.url });
    } catch (error) {
      return fail(
        `Klicket misslyckades: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  },
};

export const browserFillTool: RegisteredTool = {
  spec: {
    name: 'browser_fill',
    description: 'Fyller i ett formulärfält och kan skicka formuläret.',
    parameters: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS-selektor för fältet.' },
        value: { type: 'string', description: 'Värdet som ska skrivas.' },
        submit: {
          type: 'boolean',
          description: 'Skicka formuläret efter ifyllning.',
          default: false,
        },
      },
      required: ['selector', 'value'],
    },
    danger: 'network',
    source: 'builtin',
  },
  handler: async (args, ctx) => {
    const selector = stringArg(args, 'selector');
    const value = typeof args.value === 'string' ? args.value : null;
    if (!selector || value === null) return fail('Både "selector" och "value" krävs.');
    const driver = requireBrowser(ctx);
    if (!driver) return fail('Ingen webbläsardrivrutin är installerad.');

    const rejected = await confirmBrowserAction(
      ctx,
      'fylla i fält',
      `${selector} = ${value.slice(0, 80)}`,
    );
    if (rejected) return fail(rejected);

    try {
      const snapshot = await driver.fill(selector, value, { submit: args.submit === true });
      return ok(describeSnapshot(snapshot), { url: snapshot.url });
    } catch (error) {
      return fail(
        `Ifyllningen misslyckades: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  },
};

function describeSnapshot(snapshot: BrowserSnapshot, maxChars = 20_000): string {
  const header = `${snapshot.title || '(utan titel)'} – ${snapshot.url}`;
  const { text } = truncate(snapshot.text, maxChars);
  const errors = snapshot.consoleErrors?.length
    ? `\n\nKonsolfel:\n${snapshot.consoleErrors.join('\n')}`
    : '';
  return `${header}\n\n${text}${errors}`;
}

export const browserTools: RegisteredTool[] = [
  browserOpenTool,
  browserReadTool,
  browserScreenshotTool,
  browserClickTool,
  browserFillTool,
];
