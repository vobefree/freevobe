import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '@freevobe/protocol';
import { shouldShowReasoning, showsToolDetails, visibleMessages } from './viewMode';

function message(id: string, role: ChatMessage['role']): ChatMessage {
  return { id, role, content: id, createdAt: 0 };
}

describe('vylägen', () => {
  const messages = [message('u', 'user'), message('t', 'tool'), message('a', 'assistant')];

  it('summary visar bara samtalen', () => {
    expect(visibleMessages(messages, 'summary').map((entry) => entry.id)).toEqual(['u', 'a']);
    expect(visibleMessages(messages, 'normal')).toHaveLength(3);
    expect(visibleMessages(messages, 'verbose')).toHaveLength(3);
  });

  it('verbose visar verktygsdetaljer och resonemang', () => {
    expect(showsToolDetails('verbose')).toBe(true);
    expect(showsToolDetails('normal')).toBe(false);
    expect(shouldShowReasoning('summary')).toBe(false);
    expect(shouldShowReasoning('normal')).toBe(true);
  });
});
