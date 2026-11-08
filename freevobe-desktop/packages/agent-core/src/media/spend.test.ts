import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readMediaSpend } from './spend.js';

let root: string;

async function writeMeta(name: string, meta: Record<string, unknown>): Promise<void> {
  const directory = path.join(root, '.freevobe/media');
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, `${name}.json`), JSON.stringify(meta));
}

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'freevobe-spend-'));
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe('readMediaSpend', () => {
  it('summerar alla kända kostnader och dagens separat', async () => {
    const now = Date.now();
    const yesterday = now - 36 * 60 * 60 * 1000;
    await writeMeta('image-1.png', { costUsd: 0.02, createdAt: now });
    await writeMeta('image-2.png', { costUsd: 0.05, createdAt: now });
    await writeMeta('video-1.mp4', { costUsd: 0.1, createdAt: yesterday });

    const spend = await readMediaSpend(root, now);

    expect(spend.totalUsd).toBe(0.17);
    expect(spend.todayUsd).toBe(0.07);
    expect(spend.count).toBe(3);
  });

  it('ger noll när mappen saknas', async () => {
    await expect(readMediaSpend(root)).resolves.toEqual({
      totalUsd: 0,
      todayUsd: 0,
      count: 0,
    });
  });

  it('hoppar över trasig och kostnadsfri metadata', async () => {
    const directory = path.join(root, '.freevobe/media');
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(path.join(directory, 'broken.json'), '{inte json');
    await writeMeta('image-1.png', { costUsd: 0.02, createdAt: Date.now() });
    await writeMeta('image-2.png', { createdAt: Date.now() });

    const spend = await readMediaSpend(root);

    expect(spend.count).toBe(1);
    expect(spend.totalUsd).toBe(0.02);
  });
});
