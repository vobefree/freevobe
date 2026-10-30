import { describe, expect, it } from 'vitest';
import { ContentStreamGuard } from './textGuard.js';

const TOOL_NAMES = new Set(['propose_plan', 'read_file']);

function guard(holdLimit?: number) {
  return new ContentStreamGuard({
    isToolName: (name) => TOOL_NAMES.has(name),
    ...(holdLimit !== undefined ? { holdLimit } : {}),
  });
}

/** Matar grinden i små bitar och samlar allt som släppts igenom. */
function feed(stream: ContentStreamGuard, chunks: string[]): string {
  return chunks.map((chunk) => stream.push(chunk)).join('');
}

describe('ContentStreamGuard', () => {
  it('släpper igenom vanlig prosa direkt', () => {
    const stream = guard();
    expect(stream.push('Jag läser filen.')).toBe('Jag läser filen.');
    expect(stream.push('\nSedan byter jag texten.')).toBe('\nSedan byter jag texten.');
    expect(stream.held).toBe('');
  });

  it('visar aldrig ett plan-anrop som skrivs som JSON', () => {
    const plan = JSON.stringify({
      name: 'propose_plan',
      arguments: { title: 'Hemsida', steps: [{ title: 'Bygg sidan' }] },
    });

    const stream = guard();
    const visible = feed(stream, plan.match(/[\s\S]{1,12}/g) ?? []);

    expect(visible).toBe('');
    expect(stream.held).toContain('propose_plan');
  });

  it('släpper prosa men håller tillbaka anropet som följer', () => {
    const stream = guard();
    const visible = feed(stream, [
      'Jag kollar filen.\n',
      '```json\n',
      '{"name":"read_file",',
      '"arguments":{"path":"README.md"}}\n',
      '```',
    ]);

    // Staketets första rad hinner synas; själva anropet gör det aldrig.
    expect(visible).toBe('Jag kollar filen.\n```json\n');
    expect(stream.held).toContain('read_file');
  });

  it('släpper ett JSON-block som inte är ett verktygsanrop när det är stängt', () => {
    const stream = guard();
    const visible = feed(stream, ['Svaret är:\n', '```json\n', '{"antal": 3}\n', '```']);

    expect(visible).toBe('Svaret är:\n```json\n{"antal": 3}\n```');
    expect(stream.held).toBe('');
  });

  it('släpper ett block med okänt verktygsnamn i stället för att svälja det', () => {
    const stream = guard();
    feed(stream, ['{', '"name": "min_funktion", "arguments": {}}']);

    expect(stream.held).toBe('');
  });

  it('släpper tillbaka texten när gränsen för hur mycket som får hållas nås', () => {
    const stream = guard(20);
    const visible = feed(stream, ['{"a":', '"'.padEnd(30, 'b'), '"}']);

    expect(visible).toContain('{"a":');
  });

  it('släpper en rad som börjar med hakparentes men är prosa', () => {
    const stream = guard();
    expect(stream.push('[1] Ett citat')).toBe('[1] Ett citat');
    expect(stream.push(' från boken.')).toBe(' från boken.');
  });
});
