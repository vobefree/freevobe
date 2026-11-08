import { describe, expect, it } from 'vitest';
import { COLON_HINT, parseCommandInput, resolveColonAction } from './paletteCommands';

describe('kolonkommandon', () => {
  it('tolkar kommando och argument', () => {
    expect(parseCommandInput(':w')).toEqual({ name: 'w', rest: '' });
    expect(parseCommandInput(' :Run nu ')).toEqual({ name: 'run', rest: 'nu' });
    expect(parseCommandInput('vanlig fråga')).toBeNull();
    expect(parseCommandInput(':')).toBeNull();
  });

  it('mappar genvägarna till handlingar', () => {
    expect(resolveColonAction(':w')).toBe('save');
    expect(resolveColonAction(':q')).toBe('quit');
    expect(resolveColonAction(':run')).toBe('run');
    expect(resolveColonAction(':test')).toBe('test');
    expect(resolveColonAction(':side')).toBe('sidechat');
    expect(resolveColonAction(':okänd')).toBeNull();
  });

  it('har en hjälprad för paletten', () => {
    expect(COLON_HINT).toContain(':w');
    expect(COLON_HINT).toContain(':test');
  });
});
