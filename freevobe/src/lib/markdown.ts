/**
 * Minimal, förutsägbar Markdown-tolkning för release-anteckningar.
 *
 * Medvetet inte en fullständig Markdown-implementation: vi hanterar rubriker, punktlistor och
 * radbrytningar på blocknivå samt fetstil, inline-kod och länkar på radnivå. Ingen HTML tolkas
 * någonsin – anteckningarna kommer från GitHub och renderas alltid som textnoder och React-element.
 */

export type MarkdownBlock =
  | { kind: 'heading'; text: string }
  | { kind: 'bullet'; text: string }
  | { kind: 'text'; text: string };

export type MarkdownToken =
  | { kind: 'text'; text: string }
  | { kind: 'strong'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'link'; text: string; href: string };

/** Bara http(s) blir länkar – andra scheman (t.ex. javascript:) lämnas som vanlig text. */
const LINK = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/;

/** Markdown-kommentarer och HTML-block hoppas över helt. */
const SKIP = /^(<!--|<[a-z/!])/i;

/** Hur många rader av en release-anteckning som visas innan resten klipps bort. */
export const MAX_NOTE_LINES = 40;

export function parseMarkdown(markdown: string, maxLines = MAX_NOTE_LINES): MarkdownBlock[] {
  return markdown
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() !== '' && !SKIP.test(line.trim()))
    .slice(0, maxLines)
    .map<MarkdownBlock>((line) => {
      const trimmed = line.trim();
      if (/^#{1,6}\s+/.test(trimmed)) return { kind: 'heading', text: trimmed.replace(/^#{1,6}\s+/, '') };
      if (/^[-*+]\s+/.test(trimmed)) return { kind: 'bullet', text: trimmed.replace(/^[-*+]\s+/, '') };
      return { kind: 'text', text: trimmed };
    });
}

/** Delar upp en rad i text, fetstil, inline-kod och länkar. */
export function tokenizeInline(text: string): MarkdownToken[] {
  const pattern = new RegExp(
    `\\*\\*(.+?)\\*\\*|\`([^\`]+)\`|${LINK.source}`,
    'g',
  );
  const tokens: MarkdownToken[] = [];
  let cursor = 0;

  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > cursor) tokens.push({ kind: 'text', text: text.slice(cursor, index) });

    if (match[1] !== undefined) tokens.push({ kind: 'strong', text: match[1] });
    else if (match[2] !== undefined) tokens.push({ kind: 'code', text: match[2] });
    else if (match[3] !== undefined && match[4] !== undefined) {
      tokens.push({ kind: 'link', text: match[3], href: match[4] });
    }

    cursor = index + match[0].length;
  }

  if (cursor < text.length) tokens.push({ kind: 'text', text: text.slice(cursor) });
  return tokens;
}
