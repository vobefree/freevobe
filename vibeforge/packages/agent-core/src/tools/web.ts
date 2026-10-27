import { describeError } from '../util/errors.js';
import { truncate } from '../util/text.js';
import { fail, numberArg, ok, stringArg, type RegisteredTool } from './types.js';

const FETCH_TIMEOUT_MS = 20_000;

/** Gör HTML läsbar text. Tar bort skript, stilar och taggar men behåller radbrytningar. */
export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/(p|div|section|article|li|h[1-6]|tr|table|br)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .trim();
}

export function extractTitle(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1]?.trim();
}

export const webFetchTool: RegisteredTool = {
  spec: {
    name: 'web_fetch',
    description:
      'Hämtar en webbsida eller ett API-svar över HTTP(S) och returnerar läsbar text. Kräver godkännande.',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'http(s)-adress.' },
        method: { type: 'string', enum: ['GET', 'POST'], default: 'GET' },
        body: { type: 'string', description: 'Textinnehåll att skicka (för POST).' },
        maxChars: { type: 'integer', description: 'Max antal tecken i svaret.', default: 20000 },
      },
      required: ['url'],
    },
    danger: 'network',
    source: 'builtin',
  },
  handler: async (args, ctx) => {
    const raw = stringArg(args, 'url');
    if (!raw) return fail('Argumentet "url" saknas.');

    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      return fail(`Ogiltig URL: ${raw}`);
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return fail(`Endast http och https tillåts (fick ${url.protocol}).`);
    }

    if (ctx.approval.required) {
      const outcome = await ctx.requestApproval({
        kind: 'network',
        title: 'Hämta webbsida',
        detail: url.toString(),
        reason: ctx.approval.reason,
        risk: ctx.approval.risk,
        hardBlock: ctx.approval.hardBlock,
        url: url.toString(),
      });
      if (!outcome.approved) return fail('Användaren avvisade hämtningen.');
    }

    const method =
      typeof args.method === 'string' && args.method.toUpperCase() === 'POST' ? 'POST' : 'GET';
    try {
      const response = await ctx.fetchImpl(url.toString(), {
        method,
        ...(typeof args.body === 'string' ? { body: args.body } : {}),
        headers: {
          'user-agent': 'VibeForge/0.1 (+lokal agent)',
          accept: 'text/html,application/json,text/plain',
        },
        signal: AbortSignal.any([ctx.signal, AbortSignal.timeout(FETCH_TIMEOUT_MS)]),
      });

      const contentType = response.headers.get('content-type') ?? '';
      const rawText = await response.text();
      const text = contentType.includes('html') ? htmlToText(rawText) : rawText;
      const maxChars = Math.min(numberArg(args, 'maxChars', 20_000), 100_000);
      const { text: trimmed, truncated } = truncate(text, maxChars);
      const title = contentType.includes('html') ? extractTitle(rawText) : undefined;

      return ok(
        `${response.status} ${response.statusText} – ${url.toString()}${title ? `\nTitel: ${title}` : ''}\n\n${trimmed}`,
        { status: response.status, contentType, truncated, url: url.toString() },
      );
    } catch (error) {
      return fail(`Hämtningen misslyckades: ${describeError(error)}`);
    }
  },
};
