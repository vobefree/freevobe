import type { OllamaModel } from '@freevobe/protocol';

/**
 * Modeller som brukar ha pålitligt verktygsstöd och skriva filer i stället för att bara prata om
 * dem. Ordningen spelar roll: den första träffen vinner när storleken är lika.
 */
const CODE_MODEL_HINTS = ['coder', 'code', 'starcoder', 'codellama', 'deepseek', 'qwen'];

function looksLikeCodeModel(name: string): boolean {
  const lower = name.toLowerCase();
  return CODE_MODEL_HINTS.some((hint) => lower.includes(hint));
}

function sizeOf(model: OllamaModel): number {
  return typeof model.sizeBytes === 'number' && Number.isFinite(model.sizeBytes)
    ? model.sizeBytes
    : 0;
}

/**
 * Väljer modell åt användaren i \"prompt → klart\". Den valda modellen behålls när den kan använda
 * verktyg; annars tas den minsta installerade kodmodellen med verktygsstöd, eftersom den svarar
 * snabbast och ändå kan skriva filer. Utan sådan modell lämnas valet orört så att routern kan
 * förklara vad som saknas.
 */
export function pickInstantModel(
  models: readonly OllamaModel[],
  current: string,
): string {
  const installed = models ?? [];
  const currentModel = installed.find((model) => model.name === current);
  if (currentModel?.supportsTools) return current;

  const toolModels = installed.filter((model) => model.supportsTools);
  if (toolModels.length === 0) return current;

  const codeModels = toolModels.filter((model) => looksLikeCodeModel(model.name));
  const pool = codeModels.length > 0 ? codeModels : toolModels;
  return [...pool].sort((a, b) => sizeOf(a) - sizeOf(b))[0]?.name ?? current;
}

/**
 * Kort projektnamn från beställningen, så att det auto-skapade projektet går att känna igen i
 * listan. Punkt, frågetecken och radbrytning avslutar namnet.
 */
export function projectNameFromPrompt(prompt: string): string {
  const cleaned = prompt.replace(/\s+/g, ' ').trim();
  const firstSentence = cleaned.split(/[.!?\n]/)[0] ?? '';
  const words = firstSentence.split(' ').filter(Boolean).slice(0, 6).join(' ');
  const name = words.replace(/[.,:;]+$/, '').trim() || 'Mitt projekt';
  return name.length > 48 ? `${name.slice(0, 47)}…` : name;
}
