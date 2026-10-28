import { EMBEDDING_DIMENSIONS } from '@vibeforge/protocol';

/**
 * Freevobe använder en inbyggd, deterministisk embedding: token-hashning i ett fast
 * vektorrum (samma idé som SimHash/hashing-trick). Den kräver ingen tjänst, ingen modell
 * och inget nätverk – vilket är hela poängen med lokal-first. Den är sämre än en riktig
 * embedding-modell på semantik, men bra på att hitta filer som delar ord och symboler.
 */
export const EMBEDDING_DIMS = EMBEDDING_DIMENSIONS;

const STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'this',
  'that',
  'from',
  'are',
  'was',
  'were',
  'have',
  'has',
  'had',
  'och',
  'att',
  'det',
  'som',
  'för',
  'med',
  'inte',
  'den',
  'det',
  'kan',
  'ska',
  'till',
  'har',
  'const',
  'let',
  'var',
  'function',
  'return',
  'import',
  'export',
  'class',
  'interface',
  'type',
]);

export function tokenize(text: string): string[] {
  const tokens: string[] = [];
  // KamelCase måste delas innan texten görs om till gemener – annars försvinner gränserna.
  const matches = text.match(/[A-Za-z0-9_$#]+/g) ?? [];
  for (const token of matches) {
    const parts = token.split(/[_$#]+/).filter(Boolean);
    for (const part of parts) {
      const pieces = part
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
        .split(/\s+/)
        .map((piece) => piece.toLowerCase())
        .filter(Boolean);
      for (const piece of pieces) {
        if (piece.length >= 2 && !STOP_WORDS.has(piece)) tokens.push(piece);
      }
    }
  }
  return tokens;
}

/** FNV-1a, 32 bitar. Stabil mellan körningar och plattformar. */
export function fnv1a(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Skapar en L2-normaliserad vektor för texten. Samma text ger alltid samma vektor. */
export function embed(text: string, dimensions = EMBEDDING_DIMS): number[] {
  const vector = new Array<number>(dimensions).fill(0);
  const counts = new Map<string, number>();
  for (const token of tokenize(text)) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }

  for (const [token, count] of counts) {
    const hash = fnv1a(token);
    const index = hash % dimensions;
    const sign = (hash >>> 16) & 1 ? 1 : -1;
    // Vanlig tf-viktning med dämpning, så att upprepningar inte dominerar.
    vector[index] = (vector[index] ?? 0) + sign * (1 + Math.log(count));
  }

  return normalize(vector);
}

export function normalize(vector: number[]): number[] {
  let sum = 0;
  for (const value of vector) sum += value * value;
  const length = Math.sqrt(sum);
  if (length === 0) return vector.map(() => 0);
  return vector.map((value) => value / length);
}

export function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  const length = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let index = 0; index < length; index += 1) {
    const left = a[index] ?? 0;
    const right = b[index] ?? 0;
    dot += left * right;
    normA += left * left;
    normB += right * right;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function vectorLength(vector: readonly number[]): number {
  let sum = 0;
  for (const value of vector) sum += value * value;
  return Math.sqrt(sum);
}
