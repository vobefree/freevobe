import { describe, expect, it, vi } from 'vitest';
import { parsePullLine, pullModel, verifyPulledModel } from './pull.js';

function streamFrom(lines: string[]): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const line of lines) controller.enqueue(new TextEncoder().encode(`${line}\n`));
      controller.close();
    },
  });
  return new Response(body, { status: 200 });
}

describe('modellhämtning', () => {
  it('läser framsteg ur Ollamas NDJSON', () => {
    expect(parsePullLine('{"status":"pulling manifest"}')).toEqual({
      status: 'pulling manifest',
      percent: null,
    });
    const chunk = parsePullLine(
      '{"status":"downloading","digest":"sha256:abc","total":100,"completed":25}',
    );
    expect(chunk?.percent).toBe(25);
    expect(chunk?.digest).toBe('sha256:abc');
    expect(parsePullLine('inte json')).toBeNull();
    expect(parsePullLine('')).toBeNull();
  });

  it('jämför checksummor och godkänner aldrig en saknad', () => {
    expect(verifyPulledModel('sha256:ABC', 'abc').status).toBe('verified');
    expect(verifyPulledModel('abc', 'abd').status).toBe('mismatch');
    expect(verifyPulledModel(null, 'abc').status).toBe('unverified');
    expect(verifyPulledModel('abc', null).status).toBe('unknown');
  });

  it('hämtar aldrig något utan uttryckligt godkännande', async () => {
    const fetchImpl = vi.fn();
    const result = await pullModel({
      model: 'qwen2.5-coder:7b',
      approved: false,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/godkännande/i);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('strömmar framsteg och verifierar checksumman efter hämtningen', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      if (String(url).endsWith('/api/pull')) {
        return streamFrom([
          '{"status":"pulling manifest"}',
          '{"status":"downloading","total":1000,"completed":500}',
          '{"status":"success"}',
        ]);
      }
      return new Response(
        JSON.stringify({ models: [{ name: 'qwen2.5-coder:7b', digest: 'sha256:deadbeef' }] }),
        { status: 200 },
      );
    });
    const seen: Array<number | null> = [];
    const result = await pullModel({
      model: 'qwen2.5-coder:7b',
      approved: true,
      expectedDigest: 'deadbeef',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      onProgress: (progress) => seen.push(progress.percent),
    });

    expect(result.ok).toBe(true);
    expect(result.progress).toHaveLength(3);
    expect(seen).toContain(50);
    expect(result.verification.status).toBe('verified');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('säger ifrån när checksumman inte stämmer', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      if (String(url).endsWith('/api/pull')) return streamFrom(['{"status":"success"}']);
      return new Response(JSON.stringify({ models: [{ name: 'm', digest: 'sha256:other' }] }), {
        status: 200,
      });
    });
    const result = await pullModel({
      model: 'm',
      approved: true,
      expectedDigest: 'abc',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result.ok).toBe(true);
    expect(result.verification.status).toBe('mismatch');
  });
});
