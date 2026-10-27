import { describe, expectTypeOf, it } from 'vitest';
import type { AgentEvent } from './events.js';
import { VIBEFORGE_PROTOCOL_VERSION } from './index.js';

describe('AgentEvent', () => {
  it('kan smalnas av på type', () => {
    const event = { type: 'error', runId: 'r1', code: 'loop_limit', message: 'tak' } as AgentEvent;

    if (event.type === 'error') {
      expectTypeOf(event.code).toEqualTypeOf<
        | 'ollama_unavailable'
        | 'model_missing'
        | 'tool_not_found'
        | 'tool_invalid_args'
        | 'tool_failed'
        | 'policy_blocked'
        | 'approval_rejected'
        | 'loop_limit'
        | 'aborted'
        | 'context_budget_exceeded'
        | 'transport_error'
        | 'internal_error'
      >();
    }
  });

  it('bär en protokollversion', () => {
    expectTypeOf(VIBEFORGE_PROTOCOL_VERSION).toEqualTypeOf<1>();
  });
});
