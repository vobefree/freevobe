// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import {
  PANE_FIRST_STORAGE_KEY,
  PANE_SHARE_STORAGE_KEY,
  readPaneLayout,
  savePaneLayout,
} from './paneLayout';

afterEach(() => {
  window.localStorage.clear();
});

describe('panelayout', () => {
  it('börjar med chatten överst och delad höjd', () => {
    expect(readPaneLayout()).toEqual({ chatFirst: false, chatShare: 0.5 });
  });

  it('sparar ordning och delning', () => {
    savePaneLayout({ chatFirst: true, chatShare: 0.65 });
    expect(window.localStorage.getItem(PANE_FIRST_STORAGE_KEY)).toBe('true');
    expect(window.localStorage.getItem(PANE_SHARE_STORAGE_KEY)).toBe('0.65');
    expect(readPaneLayout()).toEqual({ chatFirst: true, chatShare: 0.65 });
  });

  it('håller delningen inom gränserna och tål skräp', () => {
    savePaneLayout({ chatFirst: false, chatShare: 0.95 });
    expect(readPaneLayout().chatShare).toBe(0.8);

    window.localStorage.setItem(PANE_SHARE_STORAGE_KEY, 'inte ett tal');
    expect(readPaneLayout().chatShare).toBe(0.5);

    window.localStorage.setItem(PANE_FIRST_STORAGE_KEY, '1');
    expect(readPaneLayout().chatFirst).toBe(false);
  });
});
