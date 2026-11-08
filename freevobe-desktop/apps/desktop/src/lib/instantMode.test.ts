import { describe, expect, it } from 'vitest';
import type { OllamaModel } from '@freevobe/protocol';
import { pickInstantModel, projectNameFromPrompt } from './instantMode';

function model(name: string, sizeBytes: number, supportsTools: boolean): OllamaModel {
  return { name, sizeBytes, supportsTools } as unknown as OllamaModel;
}

describe('pickInstantModel', () => {
  it('behåller den valda modellen när den kan använda verktyg', () => {
    const models = [model('qwen2.5-coder:7b', 4_000, true), model('llama3:8b', 5_000, true)];
    expect(pickInstantModel(models, 'llama3:8b')).toBe('llama3:8b');
  });

  it('byter till minsta kodmodell med verktygsstöd när den valda saknar verktyg', () => {
    const models = [
      model('deepseek-r1:8b', 5_000, false),
      model('qwen2.5-coder:14b', 9_000, true),
      model('qwen2.5-coder:7b', 4_000, true),
    ];
    expect(pickInstantModel(models, 'deepseek-r1:8b')).toBe('qwen2.5-coder:7b');
  });

  it('väljer aldrig en modell utan verktygsstöd', () => {
    const models = [model('mistral:7b', 4_000, false), model('phi3:mini', 2_000, false)];
    expect(pickInstantModel(models, 'mistral:7b')).toBe('mistral:7b');
  });
});

describe('projectNameFromPrompt', () => {
  it('gör ett kort projektnamn av beställningen', () => {
    expect(projectNameFromPrompt('Gör en hemsida till en frisör med bokning.')).toBe(
      'Gör en hemsida till en frisör',
    );
  });

  it('faller tillbaka på ett namn när prompten är tom', () => {
    expect(projectNameFromPrompt('   ')).toBe('Mitt projekt');
  });
});
