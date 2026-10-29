import { describe, expect, it } from 'vitest';
import { buildWorld, compileWorld } from './compile';
import { describeWorld } from './describe';
import { BIOMES } from './lexicon';
import { hasErrors, reachableTiles, validateWorld } from './validate';
import type { GeneratedWorld } from './types';

const SENTENCES = [
  'En mörk skog med en katt, tre stjärnor och stubbar',
  'Rymden med en robot som heter Månen och fem mynt',
  'Havet med en fisk, fyra snäckor och vågor',
  'Öknen med en räv och två kristaller',
  'Snölandet med en pingvin och sex isblock',
  'Staden med en hund och tre bollar',
  'Godislandet med en kanin och åtta godisbitar',
  'Vulkanen med en drake, lava och fyra kristaller',
  'Djungeln med en groda och fem bär',
  'Berget med en uggla, spikar och tre stjärnor',
  'En jättestor farlig djungel med en drake och 8 kristaller',
  'en liten skog med en katt',
  'En skog som heter "Lilla Vinter" med en katt',
  'Stjärnhimlen med en robot och sju stjärnor',
  'En stad med bilar och mynt',
];

function index(world: GeneratedWorld, point: { x: number; y: number }): number {
  return point.y * world.cols + point.x;
}

describe('compileWorld', () => {
  it('gör en spelbar värld av en mening', () => {
    const result = compileWorld('En skog med en katt och tre stjärnor');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.world.spec.target).toBe(3);
    expect(result.world.treasures).toHaveLength(3);
    expect(result.world.playable).toBe(true);
    expect(result.interpretation.spec.hero).toBe('katt');
    expect(result.interpretation.notes.length).toBeGreaterThan(0);
  });

  it('ger en karta som klarar valideringen för varje mening', () => {
    for (const sentence of SENTENCES) {
      const result = compileWorld(sentence);
      expect(result.ok, sentence).toBe(true);
      if (!result.ok) continue;

      const issues = validateWorld(result.world);
      expect(hasErrors(issues), sentence).toBe(false);

      const reachable = reachableTiles(result.world);
      expect(reachable.has(index(result.world, result.world.goal)), sentence).toBe(true);
      for (const treasure of result.world.treasures) {
        expect(reachable.has(index(result.world, treasure)), sentence).toBe(true);
      }
      expect(result.world.treasures).toHaveLength(result.world.spec.target);
    }
  });

  it('ger samma karta för samma mening, varje gång', () => {
    const first = compileWorld('en skog med en katt och tre stjärnor');
    const second = compileWorld('en skog med en katt och tre stjärnor');
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.world.terrain).toEqual(second.world.terrain);
    expect(first.world.treasures).toEqual(second.world.treasures);
  });

  it('bygger en spelbar värld för alla platser i ordlistan', () => {
    for (const biome of BIOMES) {
      const result = compileWorld(biome.title.toLowerCase());
      expect(result.ok, biome.id).toBe(true);
      if (!result.ok) continue;
      expect(result.world.spec.biome).toBe(biome.id);
      expect(hasErrors(validateWorld(result.world))).toBe(false);
    }
  });

  it('klarar tom text med en standardvärld, och säger att det är standard', () => {
    const result = compileWorld('   ');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.interpretation.notes[0]).toContain('standard');
    expect(hasErrors(validateWorld(result.world))).toBe(false);
  });

  it('förklarar varför en trasig beskrivning inte går att spela', () => {
    const spec = { ...describeWorld('skog med katt').spec, target: 0 };
    const result = buildWorld(spec);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((issue) => issue.level === 'error')).toBe(true);
    expect(result.issues.some((issue) => issue.code === 'target-out-of-range')).toBe(true);
    expect(result.issues.every((issue) => issue.fix.length > 0)).toBe(true);
  });

  it('kan bygga en ny karta ur samma beskrivning', () => {
    const spec = describeWorld('en skog med en katt och tre stjärnor').spec;
    const first = buildWorld(spec, 0);
    const second = buildWorld(spec, 3);
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.world.terrain).not.toEqual(second.world.terrain);
    expect(hasErrors(validateWorld(second.world))).toBe(false);
  });
});
