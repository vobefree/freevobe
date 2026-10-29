import { describe, expect, it } from 'vitest';
import {
  HERO_FOR_BIOME,
  MAX_INPUT_LENGTH,
  describeInWords,
  describeWorld,
  matchStem,
  sanitizeText,
  seedFromText,
} from './describe';
import { biomeById, goalById, heroById, obstacleById, treasureById } from './lexicon';

describe('sanitizeText', () => {
  it('tar bort kontrolltecken och samlar mellanslag', () => {
    expect(sanitizeText('  En\tskog\n\nmed   katt \u0007')).toBe('En skog med katt');
  });

  it('behåller å, ä och ö', () => {
    expect(sanitizeText('  Ödlan och älgen  ')).toBe('Ödlan och älgen');
  });
});

describe('matchStem', () => {
  it('hittar böjda former av korta stammar', () => {
    expect(matchStem('räven sover', ['räv'])?.stem).toBe('räv');
  });

  it('låter korta stammar matcha bara i början av ett ord', () => {
    expect(matchStem('visa mig', ['is'])).toBeNull();
    expect(matchStem('isen smälter', ['is'])?.stem).toBe('is');
  });

  it('hittar stammar inuti sammansatta ord och väljer den längsta', () => {
    expect(matchStem('i skogsgläntan', ['skog', 'glänta'])?.stem).toBe('glänta');
  });

  it('väljer den tidigaste förekomsten vid lika långa stammar', () => {
    expect(matchStem('skog och lava', ['lava', 'skog'])?.stem).toBe('skog');
  });
});

describe('seedFromText', () => {
  it('ger samma frö för samma text och olika frö för olika text', () => {
    expect(seedFromText('skog med katt')).toBe(seedFromText('skog med katt'));
    expect(seedFromText('skog med katt')).not.toBe(seedFromText('skog med hund'));
  });

  it('ger ett heltal utan tecken', () => {
    const seed = seedFromText('rymden');
    expect(Number.isInteger(seed)).toBe(true);
    expect(seed).toBeGreaterThanOrEqual(0);
  });
});

describe('describeWorld', () => {
  it('tolkar plats, hjälte, skatt och hinder från svenska ord', () => {
    const { spec } = describeWorld('En mörk skog med en katt, tre stjärnor och mycket lava');

    expect(spec.biome).toBe('forest');
    expect(spec.hero).toBe('katt');
    expect(spec.treasure).toBe('stjarna');
    expect(spec.obstacle).toBe('lava');
    expect(spec.target).toBe(3);
    expect(spec.mood).toBe('wild');
    expect(spec.name).toBe('Skogen med katten');
  });

  it('känner igen engelska ord också', () => {
    const { spec } = describeWorld('a small space world with a robot and 5 coins');
    expect(spec.biome).toBe('space');
    expect(spec.hero).toBe('robot');
    expect(spec.treasure).toBe('mynt');
    expect(spec.target).toBe(5);
    expect(spec.cols).toBe(11);
    expect(spec.rows).toBe(9);
  });

  it('gör rymden av "stjärnhimlen" trots att stjärna också är en skatt', () => {
    const { spec } = describeWorld('stjärnhimlen med en robot');
    expect(spec.biome).toBe('space');
    expect(spec.treasure).toBe('stjarna');
  });

  it('väljer en hjälte som passar världen när ingen nämndes', () => {
    const { spec, notes } = describeWorld('rymden');
    expect(spec.hero).toBe(HERO_FOR_BIOME.space);
    expect(heroById(spec.hero).label).toBe('roboten');
    expect(notes.some((note) => note.includes('ingen hjälte nämnd'))).toBe(true);
  });

  it('väljer hinder och mål som passar världen', () => {
    const ocean = describeWorld('havet').spec;
    expect(obstacleById(ocean.obstacle).label).toBe('vågorna');
    expect(goalById(ocean.goal).label).toBe('skattkistan');

    const candy = describeWorld('godislandet').spec;
    expect(goalById(candy.goal).label).toBe('slottet');
  });

  it('läser antal ur både siffror och ord', () => {
    expect(describeWorld('fem bär i skogen').spec.target).toBe(5);
    expect(describeWorld('2 bär i skogen').spec.target).toBe(2);
    expect(describeWorld('skog').spec.target).toBe(3);
  });

  it('håller antalet inom det som går att spela', () => {
    expect(describeWorld('99 stjärnor i rymden').spec.target).toBe(3);
    expect(describeWorld('1 stjärna i rymden').spec.target).toBe(1);
  });

  it('tar ett namn ur texten när barnet skriver ett', () => {
    expect(describeWorld('En skog som heter Månen med en katt').spec.name).toBe('Månen');
    expect(describeWorld('En skog som heter "Lilla Vinter" med en katt').spec.name).toBe(
      'Lilla Vinter',
    );
  });

  it('gör en fungerande standardvärld av tom text och säger det', () => {
    const { spec, notes } = describeWorld('   ');
    expect(spec.biome).toBe('forest');
    expect(spec.target).toBe(3);
    expect(notes[0]).toContain('standard');
    expect(biomeById(spec.biome).label).toBe('skogen');
  });

  it('namnger orden som inte betydde något', () => {
    const { ignored } = describeWorld('En skog med en katt och en studsmatta');
    expect(ignored).toContain('studsmatta');
    expect(ignored).not.toContain('skog');
    expect(ignored).not.toContain('med');
  });

  it('klipper text som är längre än gränsen', () => {
    const long = `skog ${'katt '.repeat(200)}`;
    expect(describeWorld(long).spec).toEqual(describeWorld(long.slice(0, MAX_INPUT_LENGTH)).spec);
  });

  it('ger samma värld för samma mening och en ny värld för en ny mening', () => {
    expect(describeWorld('en skog med en katt').spec.seed).toBe(
      describeWorld('en skog med en katt').spec.seed,
    );
    expect(describeWorld('en skog med en katt').spec.seed).not.toBe(
      describeWorld('en skog med en hund').spec.seed,
    );
  });

  it('skriver en rad för varje val, utan tomma rader', () => {
    const { notes } = describeWorld('en skog med en katt');
    expect(notes.length).toBeGreaterThanOrEqual(8);
    for (const note of notes) {
      expect(note.trim().length).toBeGreaterThan(3);
    }
  });
});

describe('describeInWords', () => {
  it('sammanfattar världen med rätt böjning', () => {
    const one = { ...describeWorld('skog med en katt').spec, target: 1 };
    expect(describeInWords(one)).toContain('1 stjärna ');
    expect(describeInWords({ ...one, target: 4 })).toContain('4 stjärnor ');
  });

  it('nämner hjälte, hinder och mål', () => {
    const spec = describeWorld('en skog med en katt, lava och en kista').spec;
    const sentence = describeInWords(spec);
    expect(sentence).toContain('katten');
    expect(sentence).toContain('lavan');
    expect(sentence).toContain('skattkistan');
    expect(treasureById(spec.treasure).plural.length).toBeGreaterThan(0);
  });
});
