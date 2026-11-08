import type { ModelPullPreview, ModelProvenance, ModelSourceKind } from '@freevobe/protocol';

/**
 * Härkomst för en modell. Ollamas officiella bibliotek ligger under `library/`; allt annat är en
 * tredjepartsnamespace som vem som helst kan publicera under. Märkningen ska synas innan en
 * hämtning, inte efter.
 */

const OFFICIAL_NAMESPACE = 'library';
const REGISTRY_HOST = 'registry.ollama.ai';

/** Delar upp `namespace/modell:tag` utan att tappa taggen. */
export function splitModelName(name: string): {
  namespace: string | null;
  model: string;
  tag: string;
} {
  const cleaned = name.trim().replace(/^ollama\//i, '');
  const [withoutTag, ...tagParts] = cleaned.split(':');
  const tag = tagParts.join(':') || 'latest';
  const parts = (withoutTag ?? '').split('/').filter(Boolean);
  if (parts.length >= 2) {
    return { namespace: parts[0] ?? null, model: parts.slice(1).join('/'), tag };
  }
  return { namespace: null, model: parts[0] ?? cleaned, tag };
}

/** Sökvägen i Ollamas register, oberoende av tagg. */
export function modelRegistryPath(name: string): string {
  const { namespace, model } = splitModelName(name);
  return `${REGISTRY_HOST}/${namespace ?? OFFICIAL_NAMESPACE}/${model}`;
}

/** Officiell när modellen ligger i `library/` (eller skrivs utan namespace). */
export function classifyModelSource(name: string): ModelSourceKind {
  const { namespace } = splitModelName(name);
  return namespace === null || namespace === OFFICIAL_NAMESPACE ? 'official' : 'third-party';
}

export function modelProvenance(name: string): ModelProvenance {
  const source = classifyModelSource(name);
  const warnings: string[] = [];
  if (source === 'third-party') warnings.push('third_party');
  return { name: name.trim(), registry: modelRegistryPath(name), source, warnings };
}

/** Normaliserar `sha256:ABC…` så att jämförelsen blir skiftlägesokänslig. */
export function normalizeDigest(value: string | null | undefined): string | null {
  if (!value) return null;
  const clean = value
    .trim()
    .replace(/^sha256:/i, '')
    .toLowerCase();
  return clean === '' ? null : clean;
}

/** Sant bara när båda sidor finns och är identiska. Saknad checksumma är aldrig ett ja. */
export function digestsMatch(
  expected: string | null | undefined,
  actual: string | null | undefined,
): boolean {
  const left = normalizeDigest(expected);
  const right = normalizeDigest(actual);
  return left !== null && right !== null && left === right;
}

export interface PullPreviewInput {
  name: string;
  sizeBytes?: number | null;
  checksum?: string | null;
}

/**
 * Det som visas innan en hämtning får starta. `requiresApproval` är alltid sant: det finns
 * ingen väg där en modell hämtas utan att användaren sett namn, källa och checksumma.
 */
export function buildPullPreview(input: PullPreviewInput): ModelPullPreview {
  const provenance = modelProvenance(input.name);
  const checksum = normalizeDigest(input.checksum);
  const warnings = [...provenance.warnings];
  if (checksum === null) warnings.push('missing_checksum');
  return {
    ...provenance,
    sizeBytes: input.sizeBytes ?? null,
    checksum,
    warnings,
    requiresApproval: true,
  };
}
