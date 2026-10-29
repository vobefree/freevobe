// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { DEFAULT_AUTO_APPROVE } from '@freevobe/protocol';
import type { AppSettings, ChatMessage } from '@freevobe/protocol';
import { ChatView } from './ChatView';
import { useAppStore } from '../../store/appStore';

Element.prototype.scrollIntoView = vi.fn();

type GivesBack = AppSettings['givesBack'];

function settingsWith(givesBack: GivesBack): AppSettings {
  return {
    ollamaBaseUrl: 'http://localhost:11434',
    defaultModel: 'qwen2.5-coder:7b',
    permissionMode: 'ask',
    autoApprove: { ...DEFAULT_AUTO_APPROVE },
    theme: 'dark',
    contextBudgetChars: 24_000,
    maxIterations: 12,
    telemetry: false,
    allowCloudServices: false,
    givesBack,
    browserAutomationEnabled: false,
    verifyAfterRun: true,
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

function setState(promptCount: number, givesBack: GivesBack) {
  useAppStore.setState({
    settings: settingsWith(givesBack),
    sessionId: 'session-1',
    messages: conversation(promptCount),
    streamingText: '',
    reasoningText: '',
    phase: 'idle',
    isRunning: false,
  });
}

const enabled: GivesBack = { enabled: true, everyNPrompts: 10, causeIds: [] };

describe('ChatView med Gives Back', () => {
  beforeEach(() => {
    setState(10, enabled);
  });

  afterEach(() => {
    cleanup();
    useAppStore.setState({ settings: null, sessionId: null, messages: [] });
  });

  it('visar exakt en Gives Back-plats efter tio prompter', () => {
    const { container } = render(<ChatView />);
    expect(container.querySelectorAll('[data-testid="gives-back-card"]').length).toBe(1);
    // Den gamla annonsplatsen finns inte kvar någonstans i flödet.
    expect(container.querySelectorAll('[data-testid="ad-slot"]').length).toBe(0);
  });

  it('visar ingen plats efter nio prompter', () => {
    setState(9, enabled);
    const { container } = render(<ChatView />);
    expect(container.querySelectorAll('[data-testid="gives-back-card"]').length).toBe(0);
  });

  it('visar platsen utanför agentsvarens bubblor', () => {
    const { container } = render(<ChatView />);
    const card = container.querySelector('[data-testid="gives-back-card"]');
    expect(card?.closest('[data-testid="message-assistant"]')).toBeNull();
  });

  it('visar ingenting när användaren inte slagit på Gives Back', () => {
    setState(20, { enabled: false, everyNPrompts: 10, causeIds: [] });
    const { container } = render(<ChatView />);
    expect(container.querySelectorAll('[data-testid="gives-back-card"]').length).toBe(0);
  });

  it('följer användarens intervall', () => {
    setState(6, { enabled: true, everyNPrompts: 3, causeIds: [] });
    const { container } = render(<ChatView />);
    expect(container.querySelectorAll('[data-testid="gives-back-card"]').length).toBe(2);
  });

  it('renderar samtliga meddelanden oavsett platsen', () => {
    setState(10, { enabled: false, everyNPrompts: 10, causeIds: [] });
    const { container } = render(<ChatView />);
    expect(container.querySelectorAll('[data-testid="message-user"]').length).toBe(10);
    expect(container.querySelectorAll('[data-testid="message-assistant"]').length).toBe(10);
  });
});
