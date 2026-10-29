import { describe, expect, it } from 'vitest';
import { GIVES_BACK_CAUSES, GIVES_BACK_PRINCIPLES } from './gives-back';

describe('Gives Back på webbplatsen', () => {
  it('har unika id:n och https-länkar till organisationerna', () => {
    const ids = GIVES_BACK_CAUSES.map((cause) => cause.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const cause of GIVES_BACK_CAUSES) {
      expect(cause.url.startsWith('https://')).toBe(true);
      expect(cause.verifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(cause.name.length).toBeGreaterThan(2);
      expect(cause.description.length).toBeGreaterThan(20);
    }
  });

  it('länkar aldrig till annonsnätverk eller en egen kassa', () => {
    for (const cause of GIVES_BACK_CAUSES) {
      const url = cause.url.toLowerCase();
      expect(url).not.toContain('adsense');
      expect(url).not.toContain('doubleclick');
      expect(url).not.toContain('freevobe');
      expect(url).not.toContain('checkout');
    }
  });

  it('lovar samma fyra principer som appen', () => {
    expect(GIVES_BACK_PRINCIPLES.map((principle) => principle.title)).toEqual([
      'No advertising',
      'No money through Freevobe',
      'Off by default',
      'Your log stays local',
    ]);
  });
});
