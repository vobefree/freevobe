import type {
  HardwareProfile,
  ModelRoute,
  RouterDecision,
  RouterModelCandidate,
  RouterReason,
  RouterRecommendation,
  RouterTaskKind,
} from '@freevobe/protocol';
import { classifyTask } from '../agent/classifier.js';
import { estimateModelBytes, fitsHardware, parseParameterBillions } from './hardware.js';
import { buildPullPreview } from './provenance.js';

/**
 * Modellroutern väljer den modell som faktiskt kan göra jobbet – och säger ifrån när ingen kan.
 *
 * Ordningen är medveten: lokal modell först (inget lämnar datorn, inget kostar pengar), därefter
 * en påslagen molnprovider, och först när ingen av dem duger en rekommendation om att hämta en
 * modell. En rekommendation hämtar aldrig något själv.
 */

/** Modeller som rekommenderas när en kodmodell med verktygsstöd saknas, i storleksordning. */
const RECOMMENDED_CODE_MODELS = ['qwen2.5-coder:3b', 'qwen2.5-coder:7b', 'qwen2.5-coder:14b'];

/** Uppgifter som kräver en modell som kan generera media, inte en textmodell. */
const MEDIA_TASKS = new Set<RouterTaskKind>(['image', 'video', 'audio']);

const MEDIA_CAPABILITY: Record<
  'image' | 'video' | 'audio',
  'image_gen' | 'video_gen' | 'audio_gen'
> = {
  image: 'image_gen',
  video: 'video_gen',
  audio: 'audio_gen',
};

/** Ord som betyder att uppgiften är större än en enskild filändring. */
const COMPLEXITY_MARKERS = [
  'refaktorera',
  'refactor',
  'arkitektur',
  'architecture',
  'hela projektet',
  'whole project',
  'migrera',
  'migrate',
  'flera filer',
  'multi-file',
  'felsök',
  'debug',
  'prestanda',
  'performance',
  'granska',
  'review',
  'planera',
  'plan',
];

const REVIEW_MARKERS = ['granska', 'review', 'kodgranskning', 'feedback', ' läs igenom'];

export interface RouterProviderInput {
  id: RouterModelCandidate['provider'];
  enabled: boolean;
  ready: boolean;
  capabilities: string[];
  models: string[];
}

export interface RouteModelInput {
  prompt: string;
  /** Lokala modeller som redan finns på datorn. */
  localModels: RouterModelCandidate[];
  /** Providers som användaren slagit på. Nycklar hanteras aldrig här. */
  providers?: RouterProviderInput[];
  hardware: HardwareProfile;
  /** Tvinga en uppgiftstyp, t.ex. när UI:t redan vet vad användaren vill. */
  taskKind?: RouterTaskKind;
  /** Sant när molntjänster är tillåtna i projektet. Standard: nej. */
  allowCloud?: boolean;
}

/** Avgör uppgiftstypen. Mediebeställningar vinner, därefter kod och till sist text. */
export function classifyRouterTask(prompt: string, forced?: RouterTaskKind): RouterTaskKind {
  if (forced) return forced;
  const classification = classifyTask(prompt);
  if (classification.outputType === 'image') return 'image';
  if (classification.outputType === 'video') return 'video';
  if (classification.outputType === 'audio') return 'audio';
  if (classification.outputType === 'code') {
    const text = prompt.toLowerCase();
    if (REVIEW_MARKERS.some((marker) => text.includes(marker))) return 'review';
    if (COMPLEXITY_MARKERS.some((marker) => text.includes(marker))) return 'complex-code';
    return 'code';
  }
  return 'text';
}

function supports(candidate: RouterModelCandidate, capability: string): boolean {
  return candidate.capabilities.includes(capability as never);
}

function billions(candidate: RouterModelCandidate): number {
  return (
    parseParameterBillions(candidate.parameterSize) ??
    parseParameterBillions(candidate.name.split(':')[1] ?? null) ??
    0
  );
}

/** Minsta modell som kan hantera uppgiften, när datorn inte har obegränsat med minne. */
function pickLocal(
  candidates: RouterModelCandidate[],
  task: RouterTaskKind,
): RouterModelCandidate[] {
  const needsTools = task !== 'text';
  const usable = candidates.filter((candidate) =>
    needsTools ? supports(candidate, 'tools') : true,
  );
  if (task === 'vision') return usable.filter((candidate) => supports(candidate, 'vision'));
  return usable;
}

/** Rekommendationen när ingen lokal modell duger. Kräver alltid ett uttryckligt ja. */
function recommend(
  hardware: HardwareProfile,
  reasons: string[],
): { recommendation: RouterRecommendation; reason: RouterReason } {
  // Välj den största rekommenderade modellen som får plats, annars den minsta. En för stor
  // hämtning är sämre än en blygsam som fungerar.
  const fitting = RECOMMENDED_CODE_MODELS.filter((name) => {
    const size = estimateModelBytes({ parameterSize: name.split(':')[1] ?? null });
    return fitsHardware(hardware, size);
  });
  const model = fitting.at(-1) ?? RECOMMENDED_CODE_MODELS[0] ?? 'qwen2.5-coder:7b';
  const size = estimateModelBytes({ parameterSize: model.split(':')[1] ?? null });
  const fits = fitsHardware(hardware, size);
  const preview = buildPullPreview({ name: model, sizeBytes: size });
  return {
    recommendation: {
      preview,
      reasons: fits ? reasons : [...reasons, 'too_large'],
      fitsHardware: fits,
      alternatives: RECOMMENDED_CODE_MODELS.filter((name) => name !== model),
    },
    reason: 'no-tool-model',
  };
}

/** Väljer en provider som kan generera mediesorten. Bara providers som är på och redo duger. */
function pickMediaProvider(
  providers: RouterProviderInput[],
  task: 'image' | 'video' | 'audio',
  allowCloud: boolean,
): { provider: RouterProviderInput; model: string } | null {
  if (!allowCloud) return null;
  const capability = MEDIA_CAPABILITY[task];
  const provider = providers.find(
    (entry) => entry.enabled && entry.ready && entry.capabilities.includes(capability),
  );
  if (!provider) return null;
  const model = provider.models[0];
  if (!model) return null;
  return { provider, model };
}

/**
 * Väljer modell för en uppgift. Resultatet är alltid ett beslut, aldrig en tyst gissning:
 * antingen en route eller en rekommendation med orsak.
 */
export function routeModel(input: RouteModelInput): RouterDecision {
  const task = classifyRouterTask(input.prompt, input.taskKind);
  const hardware = input.hardware;
  const allowCloud = input.allowCloud === true;
  const providers = input.providers ?? [];

  if (MEDIA_TASKS.has(task)) {
    const picked = pickMediaProvider(providers, task as 'image' | 'video' | 'audio', allowCloud);
    if (!picked) {
      return {
        ok: false,
        taskKind: task,
        route: null,
        recommendation: null,
        reason: allowCloud ? 'no-media-provider' : 'no-media-provider',
      };
    }
    const route: ModelRoute = {
      model: picked.model,
      provider: picked.provider.id,
      taskKind: task,
      reason: 'media-provider',
      fitsHardware: true,
    };
    return { ok: true, taskKind: task, route, recommendation: null, reason: 'media-provider' };
  }

  const candidates = pickLocal(
    input.localModels.map((candidate) => ({ ...candidate, local: true })),
    task,
  ).filter((candidate) => {
    const required = estimateModelBytes({
      sizeBytes: candidate.sizeBytes ?? null,
      parameterSize: candidate.parameterSize ?? null,
    });
    return fitsHardware(hardware, required);
  });

  if (candidates.length > 0) {
    // Kod och text klarar sig med den minsta modellen som har verktygsstöd. En stor uppgift får
    // den största som får plats, eftersom små modeller tappar tråden i långa refaktoreringar.
    const sorted = [...candidates].sort((a, b) => billions(a) - billions(b));
    const chosen =
      task === 'complex-code' || task === 'review'
        ? sorted.at(-1)
        : (sorted[0] as RouterModelCandidate);
    if (chosen) {
      return {
        ok: true,
        taskKind: task,
        route: {
          model: chosen.name,
          provider: chosen.provider,
          taskKind: task,
          reason: chosen.local ? 'local-fit' : 'cloud-provider',
          fitsHardware: true,
        },
        recommendation: null,
        reason: 'local-fit',
      };
    }
  }

  // Ingen lokal modell duger. En påslagen molnprovider med verktygsstöd får ta jobbet, men bara
  // när projektet tillåter molntjänster.
  if (allowCloud) {
    const cloud = providers.find(
      (entry) =>
        entry.id !== 'ollama' &&
        entry.enabled &&
        entry.ready &&
        entry.capabilities.includes(task === 'vision' ? 'vision' : 'tools'),
    );
    const model = cloud?.models[0];
    if (cloud && model) {
      return {
        ok: true,
        taskKind: task,
        route: {
          model,
          provider: cloud.id,
          taskKind: task,
          reason: 'cloud-provider',
          fitsHardware: true,
        },
        recommendation: null,
        reason: 'cloud-provider',
      };
    }
  }

  const { recommendation, reason } = recommend(
    hardware,
    input.localModels.length === 0 ? ['no_models'] : ['no_tool_model'],
  );
  return { ok: false, taskKind: task, route: null, recommendation, reason };
}
