import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type {
  AgentEvent,
  PreviewStatus,
  VerificationCheckResult,
  VerificationReport,
} from '@freevobe/protocol';
import { runHarness, type HarnessStreamEvent } from '../harness/harness.js';
import { startStaticPreview } from './devServer.js';
import { writeLaunchConfig } from './launchConfig.js';

function report(status: VerificationReport['status']): VerificationReport {
  const check: VerificationCheckResult = {
    id: 'typecheck',
    label: 'Typkontroll',
    kind: 'typecheck',
    command: 'npm run typecheck',
    source: 'package.json',
    status: status === 'failed' ? 'failed' : 'passed',
    exitCode: status === 'failed' ? 1 : 0,
    durationMs: 5,
    output: '',
  };
  return {
    id: 'report',
    projectId: 'p',
    trigger: 'run',
    status,
    startedAt: 1,
    finishedAt: 2,
    durationMs: 1,
    checks: [check],
    summary: 'grönt',
  } as VerificationReport;
}

async function collect(
  generator: AsyncGenerator<HarnessStreamEvent>,
): Promise<HarnessStreamEvent[]> {
  const events: HarnessStreamEvent[] = [];
  for await (const event of generator) events.push(event);
  return events;
}

describe('Fas 4 från filändring till visad preview', () => {
  it('skriver launch.json och serverar den skapade sidan på loopback', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'freevobe-fas4-'));
    await fs.writeFile(
      path.join(root, 'index.html'),
      '<!doctype html><html><head><title>Frisör</title></head><body><h1>Frisörsalong Freja</h1></body></html>',
      'utf8',
    );

    const handle = await startStaticPreview({ root });
    try {
      const runStarted: AgentEvent = {
        type: 'run_started',
        runId: 'r',
        sessionId: 's',
        model: 'm',
        mode: 'ask',
      };
      const loop = async function* () {
        yield runStarted;
        yield {
          type: 'file_changed',
          runId: 'r',
          path: 'index.html',
          kind: 'create',
        } as AgentEvent;
        yield { type: 'run_finished', runId: 'r', reason: 'final' } as AgentEvent;
      };

      const events = await collect(
        runHarness({
          runId: 'r',
          loop,
          verify: async () => report('passed'),
          preview: async (): Promise<PreviewStatus> => handle.snapshot(),
        }),
      );

      const phases = events
        .filter((event) => event.type === 'harness_phase')
        .map((event) => (event as { phase: string }).phase);
      expect(phases).toEqual(['gather', 'act', 'verify', 'deliver']);

      const previewEvent = events.find((event) => event.type === 'harness_preview') as
        { preview: PreviewStatus } | undefined;
      expect(previewEvent?.preview.status).toBe('running');
      expect(previewEvent?.preview.url).toBe(handle.url);
      expect(previewEvent?.preview.port).toBeGreaterThan(0);

      // Sluttestet utan modell: det som harness visar går att hämta och innehåller sidan.
      const response = await fetch(handle.url);
      expect(response.status).toBe(200);
      const html = await response.text();
      expect(html).toContain('Frisörsalong Freja');

      const launch = await writeLaunchConfig({
        root,
        kind: 'static',
        command: null,
        args: [],
        url: handle.url,
        port: handle.port,
      });
      const saved = JSON.parse(
        await fs.readFile(path.join(root, '.freevobe', 'launch.json'), 'utf8'),
      ) as { port: number; url: string; autoStart: boolean };
      expect(launch.path).toBe('.freevobe/launch.json');
      expect(saved).toMatchObject({ port: handle.port, url: handle.url, autoStart: true });
    } finally {
      await handle.close();
    }
  });
});
