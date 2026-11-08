import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { BrowserDriver, BrowserScreenshot, BrowserSnapshot } from './browser.js';
import { previewCheckTool } from './preview.js';
import type { ToolContext } from './types.js';

function snapshot(overrides: Partial<BrowserSnapshot> = {}): BrowserSnapshot {
  return { url: 'http://127.0.0.1:5173/', title: 'Frisör', text: 'Välkommen', ...overrides };
}

const png: BrowserScreenshot = {
  base64: Buffer.from('bild').toString('base64'),
  mimeType: 'image/png',
};

function driver(overrides: Partial<BrowserDriver> = {}): BrowserDriver {
  return {
    open: vi.fn(async () => snapshot()),
    read: vi.fn(async () => snapshot()),
    screenshot: vi.fn(async () => png),
    click: vi.fn(async () => snapshot()),
    fill: vi.fn(async () => snapshot()),
    close: vi.fn(async () => undefined),
    ...overrides,
  };
}

function context(root: string, overrides: Partial<ToolContext> = {}): ToolContext {
  return {
    root,
    projectId: 'p',
    sessionId: 's',
    runId: 'r',
    signal: new AbortController().signal,
    approval: { required: false, risk: 'low', reason: '', hardBlock: false },
    emit: () => undefined,
    requestApproval: async () => ({ approved: true }),
    proposeChange: async () => {
      throw new Error('inte här');
    },
    runHooks: async () => ({ blocked: false, output: '' }),
    exec: async () => ({
      command: '',
      exitCode: 0,
      passed: 0,
      failed: 0,
      output: '',
      timedOut: false,
    }),
    detectTestCommand: async () => null,
    fetchImpl: globalThis.fetch,
    limits: { terminalTimeoutMs: 1_000, maxOutputChars: 1_000 },
    ...overrides,
  } as ToolContext;
}

describe('preview_check', () => {
  it('öppnar previewn, sparar skärmbilden och rapporterar konsolfel', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'freevobe-preview-'));
    const browser = driver({
      open: vi.fn(async () => snapshot({ consoleErrors: ['ReferenceError: x is not defined'] })),
    });

    const result = await previewCheckTool.handler!(
      {},
      context(root, { browser, previewUrl: 'http://127.0.0.1:5173/' }),
    );

    expect(result.ok).toBe(true);
    expect(result.content).toContain('Välkommen');
    expect(result.content).toContain('ReferenceError');
    const saved = (result.data as { screenshotPath: string }).screenshotPath;
    expect(saved).toMatch(/^\.freevobe\/workspace\/screenshots\/preview-/);
    await expect(fs.stat(path.join(root, saved))).resolves.toBeTruthy();
  });

  it('vägrar adresser utanför loopback', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'freevobe-preview-'));
    const result = await previewCheckTool.handler!(
      { url: 'https://example.com' },
      context(root, { browser: driver() }),
    );
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/loopback/i);
  });

  it('säger ifrån när ingen preview eller webbläsare finns', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'freevobe-preview-'));
    const noPreview = await previewCheckTool.handler!({}, context(root, { browser: driver() }));
    expect(noPreview.ok).toBe(false);
    expect(noPreview.error).toMatch(/preview/i);

    const noBrowser = await previewCheckTool.handler!(
      {},
      context(root, { previewUrl: 'http://127.0.0.1:5173/' }),
    );
    expect(noBrowser.ok).toBe(false);
    expect(noBrowser.error).toMatch(/webbläsardrivrutin/i);
  });
});
