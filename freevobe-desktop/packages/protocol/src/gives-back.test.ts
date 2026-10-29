import { describe, expect, it } from 'vitest';
import {
  GIVES_BACK_CAUSES,
  GIVES_BACK_INTERVAL_PROMPTS,
  causeForPrompt,
  findCause,
  formatSek,
  isValidAmountSek,
  resolveCauses,
  summarizeContributions,
  type Contribution,
} from './gives-back.js';

function contribution(patch: Partial<Contribution> = {}): Contribution {
  return {
    id: 'give_1',
    causeId: 'wwf',
    amountSek: 0,
    createdAt: 1_000,
    source: 'self-reported',
    ...patch,
  };
}

describe('Gives Back-katalogen', () => {
  it('har unika id:n, https-länkar och en granskningsdag', () => {
    const ids = GIVES_BACK_CAUSES.map((cause) => cause.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const cause of GIVES_BACK_CAUSES) {
      expect(cause.url.startsWith('https://')).toBe(true);
      expect(cause.verifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(cause.tagline.length).toBeGreaterThan(10);
      expect(cause.description.length).toBeGreaterThan(20);
    }
  });

  it('innehåller inga annonsleverantörer eller betalningslänkar', () => {
    const urls = GIVES_BACK_CAUSES.map((cause) => cause.url.toLowerCase());
    for (const url of urls) {
      expect(url).not.toContain('adsense');
      expect(url).not.toContain('doubleclick');
      expect(url).not.toContain('checkout');
      // Appen länkar till organisationens sida, aldrig till en egen kassa.
      expect(url).not.toContain('freevobe');
    }
  });

  it('hittar ändamål på id', () => {
    expect(findCause('wwf')?.name).toBe('WWF');
    expect(findCause('finns-inte')).toBeUndefined();
  });
});

describe('urval och rotation', () => {
  it('behandlar tomt urval som hela katalogen', () => {
    expect(resolveCauses([])).toHaveLength(GIVES_BACK_CAUSES.length);
    expect(resolveCauses(['wwf', 'unicef']).map((cause) => cause.id)).toEqual(['unicef', 'wwf']);
  });

  it('hoppar över id:n som inte finns', () => {
    expect(resolveCauses(['wwf', 'hittepa']).map((cause) => cause.id)).toEqual(['wwf']);
  });

  it('roterar deterministiskt genom urvalet', () => {
    const ids = ['wwf', 'unicef'];
    expect(causeForPrompt(0, ids).id).toBe('unicef');
    expect(causeForPrompt(1, ids).id).toBe('wwf');
    expect(causeForPrompt(2, ids).id).toBe('unicef');
    expect(causeForPrompt(GIVES_BACK_INTERVAL_PROMPTS, ids).id).toBe(causeForPrompt(0, ids).id);
  });
});

describe('sammanställning', () => {
  it('räknar antal, summa, ändamål och senaste tillfälle', () => {
    const summary = summarizeContributions([
      contribution({ amountSek: 250, createdAt: 5 }),
      contribution({ id: 'give_2', causeId: 'unicef', amountSek: 50, createdAt: 9 }),
      contribution({ id: 'give_3', amountSek: 0, createdAt: 2 }),
    ]);
    expect(summary).toEqual({ count: 3, totalSek: 300, causeCount: 2, lastAt: 9 });
  });

  it('ger en tom sammanställning utan poster', () => {
    expect(summarizeContributions([])).toEqual({ count: 0, totalSek: 0, causeCount: 0 });
  });

  it('formaterar kronor utan ören', () => {
    expect(formatSek(1_250).replace(/\u00a0/g, ' ')).toBe('1 250 kr');
    expect(formatSek(0)).toBe('0 kr');
  });

  it('godkänner bara hela kronor i intervallet', () => {
    expect(isValidAmountSek(0)).toBe(true);
    expect(isValidAmountSek(250)).toBe(true);
    expect(isValidAmountSek(-1)).toBe(false);
    expect(isValidAmountSek(1.5)).toBe(false);
    expect(isValidAmountSek('250')).toBe(false);
    expect(isValidAmountSek(1_000_001)).toBe(false);
  });
});
