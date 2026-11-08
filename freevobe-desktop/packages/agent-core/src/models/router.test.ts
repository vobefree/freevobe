import { describe, expect, it } from 'vitest';
import type { HardwareProfile, RouterModelCandidate } from '@freevobe/protocol';
import { classifyRouterTask, routeModel } from './router.js';

const GB = 1024 ** 3;

const bigHardware: HardwareProfile = {
  totalRamGb: 64,
  freeRamGb: 48,
  vramGb: 24,
  source: 'system',
};

const smallHardware: HardwareProfile = {
  totalRamGb: 8,
  freeRamGb: 4,
  vramGb: null,
  source: 'system',
};

function local(name: string, parameterSize: string, sizeBytes?: number): RouterModelCandidate {
  return {
    name,
    provider: 'ollama',
    parameterSize,
    ...(sizeBytes === undefined ? {} : { sizeBytes }),
    capabilities: ['text', 'tools'],
    local: true,
  };
}

const models = [local('qwen2.5-coder:14b', '14b'), local('qwen2.5-coder:3b', '3b')];

describe('modellrouter', () => {
  it('klassar uppgiften innan någon modell väljs', () => {
    expect(classifyRouterTask('gör en bild av en katt')).toBe('image');
    expect(classifyRouterTask('granska koden i hela projektet')).toBe('review');
    expect(classifyRouterTask('refaktorera hela projektet')).toBe('complex-code');
    expect(classifyRouterTask('fixa buggen i index.ts')).toBe('code');
    expect(classifyRouterTask('hej')).toBe('text');
  });

  it('väljer den minsta lokala modellen för en vanlig uppgift', () => {
    const decision = routeModel({
      prompt: 'fixa buggen i index.ts',
      localModels: models,
      hardware: bigHardware,
    });
    expect(decision.ok).toBe(true);
    expect(decision.route?.model).toBe('qwen2.5-coder:3b');
    expect(decision.reason).toBe('local-fit');
    expect(decision.route?.fitsHardware).toBe(true);
  });

  it('väljer den största som får plats för en komplex uppgift', () => {
    const decision = routeModel({
      prompt: 'refaktorera hela projektet',
      localModels: models,
      hardware: bigHardware,
    });
    expect(decision.route?.model).toBe('qwen2.5-coder:14b');
  });

  it('rekommenderar en hämtning när ingen lokal modell kan använda verktyg', () => {
    const noTools: RouterModelCandidate = {
      name: 'llama3.2:1b',
      provider: 'ollama',
      capabilities: ['text'],
      local: true,
    };
    const decision = routeModel({
      prompt: 'fixa buggen i index.ts',
      localModels: [noTools],
      hardware: bigHardware,
    });
    expect(decision.ok).toBe(false);
    expect(decision.reason).toBe('no-tool-model');
    expect(decision.recommendation?.preview.requiresApproval).toBe(true);
    expect(decision.recommendation?.reasons).toContain('no_tool_model');
    expect(decision.recommendation?.preview.source).toBe('official');
  });

  it('utesluter modeller som inte får plats och föreslår en mindre', () => {
    const heavy = [local('qwen2.5-coder:14b', '14b', 9 * GB)];
    const decision = routeModel({
      prompt: 'fixa buggen i index.ts',
      localModels: heavy,
      hardware: smallHardware,
    });
    expect(decision.ok).toBe(false);
    expect(decision.recommendation?.fitsHardware).toBe(true);
    expect(decision.recommendation?.preview.name).toBe('qwen2.5-coder:3b');
  });

  it('kräver att molntjänster är tillåtna innan en molnmodell används', () => {
    const providers = [
      {
        id: 'anthropic' as const,
        enabled: true,
        ready: true,
        capabilities: ['text', 'tools'],
        models: ['claude-sonnet-4-5'],
      },
    ];
    const blocked = routeModel({
      prompt: 'fixa buggen i index.ts',
      localModels: [],
      providers,
      hardware: bigHardware,
    });
    expect(blocked.route).toBeNull();

    const allowed = routeModel({
      prompt: 'fixa buggen i index.ts',
      localModels: [],
      providers,
      hardware: bigHardware,
      allowCloud: true,
    });
    expect(allowed.route?.provider).toBe('anthropic');
    expect(allowed.reason).toBe('cloud-provider');
  });

  it('väljer en medieprovider till bild, video och ljud', () => {
    const providers = [
      {
        id: 'google' as const,
        enabled: true,
        ready: true,
        capabilities: ['image_gen', 'video_gen'],
        models: ['gemini-3.1-flash-image'],
      },
    ];
    const image = routeModel({
      prompt: 'gör en bild av en katt',
      localModels: [],
      providers,
      hardware: bigHardware,
      allowCloud: true,
    });
    expect(image.ok).toBe(true);
    expect(image.route?.provider).toBe('google');

    const video = routeModel({
      prompt: 'gör en video av en katt',
      localModels: [],
      providers,
      hardware: bigHardware,
      allowCloud: true,
    });
    expect(video.route?.model).toBe('gemini-3.1-flash-image');

    const audio = routeModel({
      prompt: 'komponera musik',
      localModels: [],
      providers,
      hardware: bigHardware,
      allowCloud: true,
    });
    expect(audio.ok).toBe(false);
    expect(audio.reason).toBe('no-media-provider');
  });
});
