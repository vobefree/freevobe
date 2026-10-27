/** Trunkerar text till max tecken och markerar att den klipptes. */
export function truncate(text: string, maxChars: number): { text: string; truncated: boolean } {
  if (maxChars <= 0) return { text: '', truncated: text.length > 0 };
  if (text.length <= maxChars) return { text, truncated: false };
  const head = Math.max(0, Math.floor(maxChars * 0.7));
  const tail = Math.max(0, maxChars - head - 40);
  const omitted = text.length - head - tail;
  const marker = `\n… [${omitted} tecken bortklippta av VibeForge] …\n`;
  return {
    text: text.slice(0, head) + marker + (tail > 0 ? text.slice(text.length - tail) : ''),
    truncated: true,
  };
}

/** Delar upp innehåll i rader utan att tappa information om avslutande radbrytning. */
export function splitLines(content: string): string[] {
  if (content === '') return [];
  const lines = content.split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  return lines.map((line, index) =>
    index === lines.length - 1 && line.endsWith('\r') ? line.slice(0, -1) : line,
  );
}

export function countLines(content: string): number {
  if (content === '') return 0;
  return content.split('\n').length - (content.endsWith('\n') ? 1 : 0);
}

export function endsWithNewline(content: string): boolean {
  return content.length > 0 && content.endsWith('\n');
}

export function ensureTrailingNewline(content: string): string {
  return content.endsWith('\n') || content === '' ? content : `${content}\n`;
}

/** Grov binärdetektering: NUL-byte eller hög andel icke-texttecken i början av filen. */
export function looksBinary(buffer: Uint8Array): boolean {
  const sample = buffer.subarray(0, 8000);
  if (sample.includes(0)) return true;
  let suspicious = 0;
  for (const byte of sample) {
    if (byte === 9 || byte === 10 || byte === 13) continue;
    if (byte < 32) suspicious += 1;
  }
  return suspicious / Math.max(1, sample.length) > 0.1;
}

export function normalizeSlashes(value: string): string {
  return value.replace(/\\/g, '/');
}

/** Enkel glob-matchning: `*`, `**`, `?` och `{a,b}`. Används av hooks och ignorerregler. */
export function matchesGlob(path: string, pattern: string): boolean {
  const normalizedPath = normalizeSlashes(path);
  const alternatives = expandBraces(pattern).map(normalizeSlashes);
  return alternatives.some((candidate) => globToRegExp(candidate).test(normalizedPath));
}

function expandBraces(pattern: string): string[] {
  const start = pattern.indexOf('{');
  if (start === -1) return [pattern];
  const end = pattern.indexOf('}', start);
  if (end === -1) return [pattern];
  const prefix = pattern.slice(0, start);
  const suffix = pattern.slice(end + 1);
  const options = pattern.slice(start + 1, end).split(',');
  return options.flatMap((option) => expandBraces(`${prefix}${option}${suffix}`));
}

function globToRegExp(pattern: string): RegExp {
  let out = '';
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index] as string;
    if (char === '*') {
      if (pattern[index + 1] === '*') {
        out += '.*';
        index += 1;
      } else {
        out += '[^/]*';
      }
    } else if (char === '?') {
      out += '[^/]';
    } else if ('.+^$()|[]\\'.includes(char)) {
      out += `\\${char}`;
    } else {
      out += char;
    }
  }
  return new RegExp(`^${out}$`);
}
