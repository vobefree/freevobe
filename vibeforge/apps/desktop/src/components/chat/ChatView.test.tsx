// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import type { AdsConfig, AppSettings, ChatMessage } from '@vibeforge/protocol';
import { ChatView } from './ChatView';
import { useAppStore } from '../../store/appStore';

Element.prototype.scrollIntoView = vi.fn();

function settingsWithAds(ads: AdsConfig): AppSettings {
  return {
    ollamaBaseUrl: 'http://localhost:11434',
    defaultModel: 'qwen2.5-coder:7b',
    permissionMode: 'ask',
    theme: 'dark',
    contextBudgetChars: 24_000,
    maxIterations: 12,
    telemetry: false,
    allowCloudServices: false,
    ads,
    browserAutomationEnabled: false,
    updatedAt: Date.now(),
  };
}

function conversation(promptCount: number): ChatMessage[] {
  const messages: ChatMessage[] = [];
  for (let index = 1; index <= promptCount; index += 1) {
    messages.push({
      id: `u${index}`,
      role: 'user',
      content: `prompt ${index}`,
      createdAt: index * 2,
    });
    messages.push({
      id: `a${index}`,
      role: 'assistant',
      content: `svar ${index}`,
      createdAt: index * 2 + 1,
    });
  }
  return messages;
}

function setState(promptCount: number, ads: AdsConfig) {
  useAppStore.setState({
    settings: settingsWithAds(ads),
    sessionId: 'session-1',
    messages: conversation(promptCount),
    streamingText: '',
    reasoningText: '',
    phase: 'idle',
    isRunning: false,
  });
}

describe('ChatView med annonsplats', () => {
  beforeEach(() => {
    setState(10, { provider: 'custom', everyNPrompts: 10, enabled: true });
  });

  afterEach(() => {
    cleanup();
    useAppStore.setState({ settings: null, sessionId: null, messages: [] });
  });

  it('visar exakt en annonsplats efter tio prompter', () => {
    const { container } = render(<ChatView />);
    expect(container.querySelectorAll('[data-testid="ad-slot"]').length).toBe(1);
  });

  it('visar ingen annonsplats efter nio prompter', () => {
    setState(9, { provider: 'custom', everyNPrompts: 10, enabled: true });
    const { container } = render(<ChatView />);
    expect(container.querySelectorAll('[data-testid="ad-slot"]').length).toBe(0);
  });

  it('visar annonsplatsen utanför agentsvarens bubblor', () => {
    setState(10, { provider: 'custom', everyNPrompts: 10, enabled: true });
    const { container } = render(<ChatView />);
    const ad = container.querySelector('[data-testid="ad-slot"]');
    expect(ad?.closest('[data-testid="message-assistant"]')).toBeNull();
  });

  it('visar ingen annonsplats när användaren stängt av annonser', () => {
    setState(20, { provider: 'custom', everyNPrompts: 10, enabled: false });
    const { container } = render(<ChatView />);
    expect(container.querySelectorAll('[data-testid="ad-slot"]').length).toBe(0);
  });

  it('renderar samtliga meddelanden oavsett annonser', () => {
    setState(10, { provider: 'none', everyNPrompts: 10, enabled: false });
    const { container } = render(<ChatView />);
    expect(container.querySelectorAll('[data-testid="message-user"]').length).toBe(10);
    expect(container.querySelectorAll('[data-testid="message-assistant"]').length).toBe(10);
  });
});
