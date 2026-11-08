/**
 * Agent harness: de fyra faserna, modellroutern, hämtning och live-preview.
 *
 * Typerna här är kontraktet mellan agent-kärnan, servern och gränssnittet. De beskriver bara
 * formen – ingen text som visas för användaren bor här, så språkvalet sker alltid i UI:t.
 */

import type { ModelPullPreview } from './models.js';
import type { ProviderCapability, ProviderId } from './providers.js';

/** De fyra faserna i en körning. Varje körning går igenom dem i ordning. */
export const HARNESS_PHASES = ['gather', 'act', 'verify', 'deliver'] as const;

export type HarnessPhase = (typeof HARNESS_PHASES)[number];

/** Datorns resurser, så att routern kan avgöra om en modell får plats. */
export interface HardwareProfile {
  totalRamGb: number;
  freeRamGb: number;
  /** Grafikminne när det går att läsa. `null` betyder okänt, inte noll. */
  vramGb: number | null;
  /** `system` = läst från datorn, `reported` = angiven av användaren, `unknown` = ingen data. */
  source: 'system' | 'reported' | 'unknown';
}

/**
 * Vad uppgiften kräver. `complex-code` är en koduppgift som är stor nog att förtjäna en större
 * modell: refaktorering över många filer, arkitektur eller felsökning utan tydlig ledtråd.
 */
export type RouterTaskKind =
  'text' | 'code' | 'complex-code' | 'review' | 'vision' | 'image' | 'video' | 'audio';

/** En modell som routern kan välja: lokal eller hos en påslagen provider. */
export interface RouterModelCandidate {
  name: string;
  provider: ProviderId;
  /** Modellfilens storlek i byte, när den är känd. */
  sizeBytes?: number;
  parameterSize?: string;
  capabilities: ProviderCapability[];
  local: boolean;
}

/** Varför en modell valdes. Gränssnittet översätter koden till en mening. */
export type RouterReason =
  | 'routed'
  | 'local-fit'
  | 'cloud-provider'
  | 'media-provider'
  | 'no-tool-model'
  | 'no-media-provider'
  | 'no-model';

export interface ModelRoute {
  model: string;
  provider: ProviderId;
  taskKind: RouterTaskKind;
  reason: RouterReason;
  fitsHardware: boolean;
}

/** En rekommendation när ingen modell duger: vad som bör hämtas och varför. */
export interface RouterRecommendation {
  preview: ModelPullPreview;
  /** Koder som förklarar valet, t.ex. `tool_calling` eller `too_large`. */
  reasons: string[];
  fitsHardware: boolean;
  /** Mindre eller större varianter som också fungerar. */
  alternatives: string[];
}

export interface RouterDecision {
  ok: boolean;
  taskKind: RouterTaskKind;
  route: ModelRoute | null;
  recommendation: RouterRecommendation | null;
  reason: RouterReason;
}

/** Hur en dev-server startas. `static` betyder att filerna serveras direkt, utan byggsteg. */
export type PreviewKind = 'static' | 'vite' | 'next' | 'nuxt' | 'astro' | 'svelte' | 'npm-dev';

export interface DevServerDetection {
  kind: PreviewKind | null;
  /** Kommandot som startar servern. `null` när inget dev-skript finns. */
  command: string | null;
  args: string[];
  /** Adressen servern väntas svara på, när den går att räkna ut i förväg. */
  url: string | null;
  /** Var det hittades: `package.json`, `vite.config.ts`, `index.html`. */
  source: string;
}

export type PreviewServerStatus = 'idle' | 'starting' | 'running' | 'stopped' | 'error';

export interface PreviewStatus {
  status: PreviewServerStatus;
  kind: PreviewKind | null;
  command: string | null;
  url: string | null;
  port: number | null;
  /** De sista raderna ur serverns logg, för felsökning i panelen. */
  logTail: string[];
  error?: string;
}

/** Ett steg i en modellhämtning, som Ollama strömmar den. */
export interface PullProgress {
  status: string;
  digest?: string;
  totalBytes?: number;
  completedBytes?: number;
  /** 0–100, eller `null` när storleken ännu inte är känd. */
  percent: number | null;
}

/** Resultatet av checksummekontrollen efter en hämtning. */
export interface ModelPullVerification {
  /** `verified` kräver att både förväntad och faktisk checksumma finns och är lika. */
  status: 'verified' | 'mismatch' | 'unverified' | 'unknown';
  expected: string | null;
  actual: string | null;
}

export interface ModelPullResult {
  model: string;
  ok: boolean;
  progress: PullProgress[];
  verification: ModelPullVerification;
  error?: string;
}

/** Händelser som harness-motorn lägger till ovanpå agentens egna. */
export type HarnessEvent =
  | { type: 'harness_phase'; runId: string; phase: HarnessPhase; at: number }
  | { type: 'harness_preview'; runId: string; preview: PreviewStatus }
  | {
      type: 'harness_route';
      runId: string;
      route: ModelRoute | null;
      recommendation: RouterRecommendation | null;
    };
