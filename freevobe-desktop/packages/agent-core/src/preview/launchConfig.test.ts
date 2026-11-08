import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildLaunchConfig, writeLaunchConfig } from './launchConfig.js';

describe('launch.json', () => {
  it('skriver kommando, port och adress i projektets .freevobe-mapp', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'freevobe-launch-'));
    const result = await writeLaunchConfig({
      root,
      kind: 'vite',
      command: 'npm',
      args: ['run', 'dev'],
      url: 'http://127.0.0.1:5173/',
      port: 5173,
    });

    expect(result.path).toBe('.freevobe/launch.json');
    const written = JSON.parse(
      await fs.readFile(path.join(root, '.freevobe', 'launch.json'), 'utf8'),
    ) as Record<string, unknown>;
    expect(written).toMatchObject({
      version: 1,
      kind: 'vite',
      command: 'npm',
      args: ['run', 'dev'],
      url: 'http://127.0.0.1:5173/',
      port: 5173,
      autoStart: true,
    });
    expect(String(written.updatedAt)).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('klarar en statisk preview utan kommando', () => {
    const config = buildLaunchConfig(
      {
        root: '/tmp/projekt',
        kind: 'static',
        command: null,
        args: [],
        url: 'http://127.0.0.1:4010/',
        port: 4010,
      },
      new Date('2026-01-02T03:04:05.000Z'),
    );
    expect(config.command).toBeNull();
    expect(config.updatedAt).toBe('2026-01-02T03:04:05.000Z');
  });
});
