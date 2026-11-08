import { describe, expect, it } from 'vitest';
import type { ToolSpec } from '@freevobe/protocol';
import { evaluateToolCall } from './policy.js';

const previewSpec = {
  name: 'preview_check',
  description: 'Granska den lokala previewn.',
  parameters: { type: 'object', properties: {} },
  danger: 'network',
  source: 'builtin',
} as ToolSpec;

describe('preview_check i prompt → klart', () => {
  it('körs utan godkännande eftersom den bara läser loopback', () => {
    const decision = evaluateToolCall(
      { spec: previewSpec, args: {} },
      {
        root: '/tmp/projekt',
        mode: 'ask',
        browserAutomationEnabled: true,
        mcpServerApproved: () => false,
      },
    );
    expect(decision.effect).toBe('allow');
  });

  it('påverkas inte av att webbläsarautomation är avstängd', () => {
    const decision = evaluateToolCall(
      { spec: previewSpec, args: {} },
      {
        root: '/tmp/projekt',
        mode: 'ask',
        browserAutomationEnabled: false,
        mcpServerApproved: () => false,
      },
    );
    expect(decision.effect).toBe('allow');
  });
});
