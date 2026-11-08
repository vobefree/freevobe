// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { useAppStore } from './appStore';

afterEach(() => {
  window.localStorage.clear();
  useAppStore.setState({
    themeMode: 'system',
    viewMode: 'normal',
    qoderMode: false,
    chatFirst: false,
    chatShare: 0.5,
    sideChatOpen: false,
  });
});

describe('utseende och layout i storen', () => {
  it('byter tema och sparar valet', () => {
    useAppStore.getState().setThemeMode('light');
    expect(useAppStore.getState().themeMode).toBe('light');
    expect(useAppStore.getState().resolvedTheme).toBe('light');
    expect(window.localStorage.getItem('freevobe.theme')).toBe('light');
  });

  it('byter vyläge och qoder-läge', () => {
    useAppStore.getState().setViewMode('summary');
    expect(useAppStore.getState().viewMode).toBe('summary');
    expect(window.localStorage.getItem('freevobe.viewMode')).toBe('summary');

    useAppStore.getState().toggleQoder();
    expect(useAppStore.getState().qoderMode).toBe(true);
    expect(window.localStorage.getItem('freevobe.qoder')).toBe('true');
  });

  it('byter paneordning och håller delningen inom gränserna', () => {
    useAppStore.getState().setChatFirst(true);
    expect(useAppStore.getState().chatFirst).toBe(true);
    expect(window.localStorage.getItem('freevobe.paneFirst')).toBe('true');

    useAppStore.getState().setChatShare(0.95);
    expect(useAppStore.getState().chatShare).toBe(0.8);
    expect(window.localStorage.getItem('freevobe.paneShare')).toBe('0.8');
    useAppStore.getState().setChatShare(0.1);
    expect(useAppStore.getState().chatShare).toBe(0.2);
    expect(window.localStorage.getItem('freevobe.paneShare')).toBe('0.2');
  });

  it('stänger sidchatten utan att röra huvudchatten', () => {
    useAppStore.setState({ sideChatOpen: true });
    useAppStore.getState().closeSideChat();
    expect(useAppStore.getState().sideChatOpen).toBe(false);
  });
});
