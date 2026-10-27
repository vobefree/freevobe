import { describe, expect, it } from 'vitest';
import { MAX_NOTE_LINES, parseMarkdown, tokenizeInline } from './markdown';

describe('parseMarkdown', () => {
  it('känner igen rubriker och punkter', () => {
    const blocks = parseMarkdown('## Added\n- one\n* two\n+ three\n\nplain line');
    expect(blocks).toEqual([
      { kind: 'heading', text: 'Added' },
      { kind: 'bullet', text: 'one' },
      { kind: 'bullet', text: 'two' },
      { kind: 'bullet', text: 'three' },
      { kind: 'text', text: 'plain line' },
    ]);
  });

  it('kastar bort kommentarer och HTML-block och klipper långa anteckningar', () => {
    const blocks = parseMarkdown('<!-- dold -->\n<span>hej</span>\nrad');
    expect(blocks).toEqual([{ kind: 'text', text: 'rad' }]);
    expect(parseMarkdown(Array.from({ length: 90 }, () => 'rad').join('\n'))).toHaveLength(
      MAX_NOTE_LINES,
    );
  });
});

describe('tokenizeInline', () => {
  it('gör länkar, fetstil och kod till egna delar', () => {
    const tokens = tokenizeInline('Se [Windows](https://example.test/a.exe) och **viktigt** och `kod`');
    expect(tokens).toEqual([
      { kind: 'text', text: 'Se ' },
      { kind: 'link', text: 'Windows', href: 'https://example.test/a.exe' },
      { kind: 'text', text: ' och ' },
      { kind: 'strong', text: 'viktigt' },
      { kind: 'text', text: ' och ' },
      { kind: 'code', text: 'kod' },
    ]);
  });

  it('länkar inte osäkra eller relativa adresser', () => {
    const tokens = tokenizeInline('[klicka](javascript:alert(1)) och [relativ](/download/)');
    expect(tokens.every((token) => token.kind === 'text')).toBe(true);
    expect(tokens.map((token) => token.text).join('')).toBe(
      '[klicka](javascript:alert(1)) och [relativ](/download/)',
    );
  });

  it('lämnar vanlig text orörd', () => {
    expect(tokenizeInline('bara text')).toEqual([{ kind: 'text', text: 'bara text' }]);
  });
});
