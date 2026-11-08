import { saveScreenshot } from './browser.js';
import { isLoopbackUrl } from '../preview/devServer.js';
import { fail, ok, stringArg, type RegisteredTool } from './types.js';

/**
 * `preview_check` ger agenten ögon: den öppnar den körande previewn, läser sidan, tar en
 * skärmbild och rapporterar konsolfel. Bara loopback, bara efter användarens ja. Skärmbilden
 * sparas i workspace-mappen och kan sedan analyseras med `analyze_image`.
 */
export const previewCheckTool: RegisteredTool = {
  spec: {
    name: 'preview_check',
    description:
      'Granskar den körande live-previewn: öppnar adressen i en kontrollerad webbläsare, läser sidan, tar en skärmbild och rapporterar konsolfel. Använd den för att se resultatet av en ändring och rätta visuella fel. Fungerar bara mot loopback (127.0.0.1/localhost) och kräver ditt godkännande.',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'Adress att granska. Standard: den preview som redan är igång.',
        },
        label: {
          type: 'string',
          description: 'Etikett i skärmbildens filnamn.',
          default: 'preview',
        },
      },
    },
    danger: 'network',
    source: 'builtin',
  },
  handler: async (args, ctx) => {
    const url = stringArg(args, 'url') ?? ctx.previewUrl ?? null;
    if (!url) {
      return fail(
        'Ingen preview är igång. Starta previewn först, eller skicka adressen som "url".',
      );
    }
    if (!isLoopbackUrl(url)) {
      return fail('Preview får bara granskas på loopback (127.0.0.1 eller localhost).');
    }
    const driver = ctx.browser;
    if (!driver) {
      return fail(
        'Ingen webbläsardrivrutin är installerad. Kör "npx playwright install chromium" och slå på webbläsarautomation i Inställningar.',
      );
    }

    const outcome = await ctx.requestApproval({
      kind: 'browser',
      title: 'Webbläsare: granska preview',
      detail: url,
      reason:
        ctx.approval.reason && ctx.approval.reason !== 'Tillåtet.'
          ? ctx.approval.reason
          : 'Webbläsarautomation kräver alltid ditt godkännande.',
      risk: ctx.approval.risk,
      hardBlock: true,
      url,
    });
    if (!outcome.approved) return fail('Användaren avvisade granskningen av previewn.');

    try {
      const snapshot = await driver.open(url);
      const shot = await driver.screenshot({ fullPage: true });
      const saved = await saveScreenshot(
        ctx.root,
        shot.base64,
        stringArg(args, 'label') ?? 'preview',
      );
      const errors = snapshot.consoleErrors ?? [];
      const lines = [
        `${snapshot.title || '(utan titel)'} – ${snapshot.url}`,
        '',
        snapshot.text.slice(0, 6_000),
      ];
      if (errors.length > 0) lines.push('', 'Konsolfel:', ...errors);
      lines.push('', `Skärmbild: ${saved}`);
      return ok(lines.join('\n'), {
        url: snapshot.url,
        title: snapshot.title,
        screenshotPath: saved,
        consoleErrors: errors,
      });
    } catch (error) {
      return fail(
        `Kunde inte granska previewn: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  },
};

export const previewTools: RegisteredTool[] = [previewCheckTool];
