import { parseTextualToolCalls, type TextualToolCallOptions } from './openai.js';

export interface ContentStreamGuardOptions {
  /** Namnen på verktygen – ett block med okänt namn är text, inte ett anrop. */
  isToolName?: (name: string) => boolean;
  /** Hur mycket text grinden högst håller tillbaka innan den släpper den vidare. */
  holdLimit?: number;
}

/**
 * Gränsen är generös: ett planförslag med många steg ryms, men en modell som skriver en hel
 * fil i JSON ska inte kunna tysta chatten under resten av svaret.
 */
const DEFAULT_HOLD_LIMIT = 4_000;

/**
 * Text som kan börja ett JSON-block, ett ```-staket eller en `<tool_call>`-tagg. En rad som börjar
 * med `[` räknas bara när den inleder en lista av objekt – `[1] Ett citat` är prosa.
 */
function startsBlock(text: string): boolean {
  if (text.startsWith('{') || text.startsWith('<tool_call>')) return true;
  // Ett staket är bara intressant när det innehåller JSON – ett stängt staket följt av prosa
  // (eller ett kodblock i valfritt språk) ska strömma som vanligt.
  if (text.startsWith('```')) return /^```[\w-]*\r?\n[ \t]*\{/.test(text);
  return /^\[\s*\{/.test(text);
}

/** Första rad som börjar som ett möjligt verktygsanrop, eller -1 om texten är ren prosa. */
function findBlockStart(text: string, from: number): number {
  let index = from === 0 ? 0 : text.lastIndexOf('\n', from - 1) + 1;
  // Raden som `from` pekar in i är redan skickad – leta bara framåt.
  while (index < from) {
    const next = text.indexOf('\n', index);
    if (next === -1) return -1;
    index = next + 1;
  }

  while (index < text.length) {
    const rest = text.slice(index);
    const trimmed = rest.replace(/^[ \t]+/, '');
    if (startsBlock(trimmed)) return index + (rest.length - trimmed.length);

    const next = text.indexOf('\n', index);
    if (next === -1) return -1;
    index = next + 1;
  }

  return -1;
}

/** Sant när det hållna blocket är färdigt och bevisligen inte är ett verktygsanrop. */
function isPlainText(held: string, options: TextualToolCallOptions): boolean {
  const trimmed = held.trimEnd();

  if (trimmed.startsWith('<tool_call>')) {
    if (!trimmed.endsWith('</tool_call>')) return false;
    return parseTextualToolCalls(trimmed, options).length === 0;
  }

  if (trimmed.startsWith('```')) {
    const fenceEnd = trimmed.indexOf('```', 3);
    const closed = fenceEnd !== -1;
    const body = closed ? trimmed.slice(3, fenceEnd) : trimmed.slice(3);
    // Ett staket som inte stängts släpps först när innehållet ser färdigt ut.
    if (!closed && !/[}\]]$/.test(body.trimEnd())) return false;
    return parseTextualToolCalls(body, options).length === 0;
  }

  if (!trimmed.endsWith('}') && !trimmed.endsWith(']')) return false;
  return parseTextualToolCalls(trimmed, options).length === 0;
}

/**
 * Håller tillbaka strömmad text som kan visa sig vara ett verktygsanrop.
 *
 * Lokala modeller skriver ibland anropet som JSON i själva svaret. Utan grind hinner rå JSON synas
 * i chatten innan loopen hunnit tolka den. Grinden släpper igenom prosa direkt och håller bara det
 * som börjar som ett block – och släpper det igen så fort blocket är färdigt och inte är ett anrop.
 * Hela svaret går ändå ut som `assistant_message` när varvet är slut, så inget text tappas.
 */
export class ContentStreamGuard {
  private readonly options: TextualToolCallOptions;
  private readonly holdLimit: number;
  private buffer = '';
  /** Första tecken som ännu inte lämnats till chatten. */
  private emitFrom = 0;
  /** Var det tillbakahållna blocket börjar, eller -1 när inget hålls. */
  private holdStart = -1;

  constructor(options: ContentStreamGuardOptions = {}) {
    this.options = options.isToolName ? { isToolName: options.isToolName } : {};
    this.holdLimit = options.holdLimit ?? DEFAULT_HOLD_LIMIT;
  }

  /** Lägger till ett delta och svarar med den text som säkert kan visas nu. */
  push(delta: string): string {
    if (delta === '') return '';
    this.buffer += delta;
    let visible = '';

    if (this.holdStart === -1) {
      const start = findBlockStart(this.buffer, this.emitFrom);
      if (start === -1) {
        visible += this.buffer.slice(this.emitFrom);
        this.emitFrom = this.buffer.length;
        return visible;
      }

      // Prosa fram till blocket kan visas direkt; blocket hålls tillbaka tills vi vet vad det är.
      visible += this.buffer.slice(this.emitFrom, start);
      this.emitFrom = start;
      this.holdStart = start;
    }

    const held = this.buffer.slice(this.holdStart);
    if (held.length > this.holdLimit || isPlainText(held, this.options)) {
      // Färdigt block som inte är ett verktygsanrop (eller för stort för att hållas): släpp allt.
      visible += this.buffer.slice(this.emitFrom);
      this.emitFrom = this.buffer.length;
      this.holdStart = -1;
    }

    return visible;
  }

  /** Texten som hålls tillbaka just nu. Tom när inget hålls. */
  get held(): string {
    return this.holdStart === -1 ? '' : this.buffer.slice(this.holdStart);
  }
}
