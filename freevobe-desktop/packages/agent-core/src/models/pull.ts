import type { ModelPullResult, ModelPullVerification, PullProgress } from '@freevobe/protocol';
import { DEFAULT_OLLAMA_URL } from '@freevobe/protocol';
import { digestsMatch, normalizeDigest } from './provenance.js';

/**
 * Hämtning av en modell från Ollama. Två regler styr allt här:
 *
 * 1. Ingenting hämtas utan `approved: true`. Anropet avvisas innan något nätverk rörs.
 * 2. Efter hämtningen jämförs checksumman med den förväntade. Saknas någon av dem är svaret
 *    `unverified` – aldrig `verified`.
 */

interface PullLine {
  status?: string;
  digest?: string;
  total?: number;
  completed?: number;
  error?: string;
}

/** Läser en rad ur Ollamas NDJSON-ström. Okända rader blir `null`, inte ett kastat fel. */
export function parsePullLine(line: string): PullProgress | null {
  const trimmed = line.trim();
  if (trimmed === '') return null;
  let parsed: PullLine;
  try {
    parsed = JSON.parse(trimmed) as PullLine;
  } catch {
    return null;
  }
  if (typeof parsed.status !== 'string' && typeof parsed.error !== 'string') return null;

  const progress: PullProgress = {
    status: typeof parsed.error === 'string' ? 'error' : (parsed.status ?? 'unknown'),
    percent: null,
  };
  if (typeof parsed.digest === 'string' && parsed.digest !== '') progress.digest = parsed.digest;
  if (typeof parsed.total === 'number' && parsed.total > 0) {
    progress.totalBytes = parsed.total;
    if (typeof parsed.completed === 'number' && parsed.completed >= 0) {
      progress.completedBytes = parsed.completed;
      progress.percent = Math.min(100, Math.round((parsed.completed / parsed.total) * 100));
    }
  }
  return progress;
}

export interface PullModelOptions {
  model: string;
  /** Måste vara sant. En modell hämtas aldrig på eget bevåg. */
  approved: boolean;
  baseUrl?: string;
  /** Checksumman som visades före hämtningen, om användaren hade en. */
  expectedDigest?: string | null;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
  onProgress?: (progress: PullProgress) => void;
}

/** Hämtar modellens digest från `/api/tags`, så att checksumman kan kontrolleras efteråt. */
export async function readInstalledDigest(
  model: string,
  options: { baseUrl?: string; fetchImpl?: typeof fetch; signal?: AbortSignal } = {},
): Promise<string | null> {
  const baseUrl = (options.baseUrl ?? DEFAULT_OLLAMA_URL).replace(/\/+$/, '');
  const response = await (options.fetchImpl ?? globalThis.fetch)(`${baseUrl}/api/tags`, {
    method: 'GET',
    signal: options.signal ?? null,
  });
  if (!response.ok) return null;
  const body = (await response.json()) as {
    models?: Array<{ name?: string; model?: string; digest?: string }>;
  };
  const entry = (body.models ?? []).find(
    (candidate) => candidate.name === model || candidate.model === model,
  );
  return normalizeDigest(entry?.digest);
}

export function verifyPulledModel(
  expected: string | null | undefined,
  actual: string | null | undefined,
): ModelPullVerification {
  const expectedNormalized = normalizeDigest(expected);
  const actualNormalized = normalizeDigest(actual);
  if (expectedNormalized === null) {
    return { status: 'unverified', expected: null, actual: actualNormalized };
  }
  if (actualNormalized === null) {
    return { status: 'unknown', expected: expectedNormalized, actual: null };
  }
  return {
    status: digestsMatch(expectedNormalized, actualNormalized) ? 'verified' : 'mismatch',
    expected: expectedNormalized,
    actual: actualNormalized,
  };
}

/**
 * Hämtar en modell och strömmar framstegen. Kastar aldrig ett tyst fel: antingen blir resultatet
 * `ok` med en checksumma, eller `ok: false` med ett begripligt fel.
 */
export async function pullModel(options: PullModelOptions): Promise<ModelPullResult> {
  if (options.approved !== true) {
    return {
      model: options.model,
      ok: false,
      progress: [],
      verification: { status: 'unverified', expected: null, actual: null },
      error: 'Hämtningen kräver ett uttryckligt godkännande.',
    };
  }

  const baseUrl = (options.baseUrl ?? DEFAULT_OLLAMA_URL).replace(/\/+$/, '');
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const progress: PullProgress[] = [];

  try {
    const response = await fetchImpl(`${baseUrl}/api/pull`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: options.model, stream: true }),
      signal: options.signal ?? null,
    });
    if (!response.ok) {
      return {
        model: options.model,
        ok: false,
        progress,
        verification: { status: 'unverified', expected: null, actual: null },
        error: `Ollama svarade ${response.status}.`,
      };
    }

    const body = response.body;
    if (body) {
      const reader = body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          const parsed = parsePullLine(line);
          if (!parsed) continue;
          progress.push(parsed);
          options.onProgress?.(parsed);
        }
      }
      const tail = parsePullLine(buffer);
      if (tail) {
        progress.push(tail);
        options.onProgress?.(tail);
      }
    }

    const failed = progress.find((entry) => entry.status === 'error');
    if (failed) {
      return {
        model: options.model,
        ok: false,
        progress,
        verification: { status: 'unverified', expected: null, actual: null },
        error: 'Ollama avbröt hämtningen.',
      };
    }

    const actual = await readInstalledDigest(options.model, {
      baseUrl,
      fetchImpl,
      ...(options.signal ? { signal: options.signal } : {}),
    });
    return {
      model: options.model,
      ok: true,
      progress,
      verification: verifyPulledModel(options.expectedDigest ?? null, actual),
    };
  } catch (error) {
    return {
      model: options.model,
      ok: false,
      progress,
      verification: { status: 'unverified', expected: null, actual: null },
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
