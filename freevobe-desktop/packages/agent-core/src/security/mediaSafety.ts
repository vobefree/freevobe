import { scanForSecrets } from './secrets.js';

export interface MediaSafetyIssue {
  reason: string;
  detail: string;
}

/**
 * Försök att få providerns egna säkerhetsfilter att stängas av. Freevobe kringgår aldrig dem –
 * providern ansvarar för sin moderation, och vi skickar aldrig en instruktion som ber om att den
 * ska ignoreras.
 */
const SAFETY_BYPASS: RegExp[] = [
  /\b(?:bypass|kringgå|kringga|ignore|ignorera|disable|stäng av|stang av|turn off|skip)\b[^.\n]{0,40}\b(?:safety|filter|filters|guardrails?|moderation|policy|policies|säkerhet|sakerhet|skyddsfilter)\b/i,
  /\b(?:no|without|inga|utan)\s+(?:safety|content|restrictions?|filters?|begränsningar)\b/i,
  /\b(?:uncensored|ocensurerad|oavkortad|nsfw[- ]?mode)\b/i,
];

/**
 * Sexuellt innehåll som involverar minderåriga. Regeln är ett hårt block i alla lägen och gäller
 * både generering och analys – den går inte att godkänna bort.
 */
const MINOR_SEXUAL: RegExp[] = [
  /\b(?:child|children|kid|kids|minor|minors|underage|preteen|teen|teens|teenager|barn|barnet|minderårig|minderåriga|tonåring|tonåringar)\b[^.\n]{0,60}\b(?:nude|naked|nudes|sexual|sexually|porn|porno|erotic|nsfw|naken|naket|nakna|sexuell|sexuellt|porr|erotisk)\b/i,
  /\b(?:nude|naked|nudes|sexual|porn|porno|erotic|naken|naket|nakna|sexuell|sexuellt|porr|erotisk)\b[^.\n]{0,60}\b(?:child|children|kid|kids|minor|minors|underage|preteen|barn|minderårig|minderåriga)\b/i,
  /\b(?:loli|lolita|shota|shotacon)\b/i,
];

function texts(args: Record<string, unknown>): string[] {
  const values: string[] = [];
  for (const key of ['prompt', 'question']) {
    const value = args[key];
    if (typeof value === 'string' && value.trim() !== '') values.push(value);
  }
  return values;
}

/**
 * Bedömer texten i ett medieanrop innan något skickas till en provider. Returnerar null när
 * anropet får fortsätta till godkännandet. Reglerna här är hårda: de kan inte auto-godkännas och
 * gäller även i Full auto.
 */
export function scanMediaRequest(args: Record<string, unknown>): MediaSafetyIssue | null {
  const candidates = texts(args);
  if (candidates.length === 0) return null;

  for (const text of candidates) {
    if (MINOR_SEXUAL.some((pattern) => pattern.test(text))) {
      return {
        reason: 'Medieanropet blockerades av säkerhetsregeln om sexuellt innehåll med minderåriga.',
        detail:
          'Regeln gäller i alla behörighetslägen och går inte att godkänna bort. Formulera om prompten.',
      };
    }
  }

  for (const text of candidates) {
    if (SAFETY_BYPASS.some((pattern) => pattern.test(text))) {
      return {
        reason: 'Medieanropet försöker stänga av providerns säkerhetsfilter.',
        detail:
          'Freevobe kringgår aldrig leverantörens moderation. Ta bort instruktionen om att ignorera filter och beskriv i stället vad bilden, videon eller ljudet ska innehålla.',
      };
    }
  }

  for (const text of candidates) {
    if (scanForSecrets(text).length > 0) {
      return {
        reason: 'Medieprompten ser ut att innehålla en hemlighet.',
        detail:
          'Prompts skickas till leverantören. Ta bort API-nycklar, tokens och lösenord ur texten och försök igen.',
      };
    }
  }

  return null;
}
