import { describe, expect, it } from 'vitest';
import { consumeSseStream, createSseParser, type SseEvent } from './sse';

function collect(): { events: SseEvent[]; parser: ReturnType<typeof createSseParser> } {
  const events: SseEvent[] = [];
  return { events, parser: createSseParser((event) => events.push(event)) };
}

describe('createSseParser', () => {
  it('läser en komplett händelse', () => {
    const { events, parser } = collect();
    parser.push('event: status\ndata: {"phase":"thinking"}\n\n');
    expect(events).toEqual([{ event: 'status', data: '{"phase":"thinking"}' }]);
  });

  it('väntar med en halv händelse och levererar när resten kommer', () => {
    const { events, parser } = collect();
    parser.push('data: {"a"');
    expect(events).toHaveLength(0);
    parser.push(':1}\n\n');
    expect(events).toEqual([{ event: '', data: '{"a":1}' }]);
  });

  it('delar upp flera händelser i samma chunk', () => {
    const { events, parser } = collect();
    parser.push('data: ett\n\ndata: två\n\n');
    expect(events.map((event) => event.data)).toEqual(['ett', 'två']);
  });

  it('hanterar CRLF och ignorerar kommentarer', () => {
    const { events, parser } = collect();
    parser.push(': ansluten\r\n\r\n');
    expect(events).toHaveLength(0);
    parser.push('data: klar\r\n\r\n');
    expect(events.map((event) => event.data)).toEqual(['klar']);
  });

  it('slår ihop flera data-rader och tar bort ett inledande blanksteg', () => {
    const { events, parser } = collect();
    parser.push('data: rad ett\ndata: rad två\n\n');
    expect(events[0]?.data).toBe('rad ett\nrad två');
  });

  it('levererar en sista händelse utan avslutande tom rad vid flush', () => {
    const { events, parser } = collect();
    parser.push('data: sista');
    expect(events).toHaveLength(0);
    parser.flush();
    expect(events.map((event) => event.data)).toEqual(['sista']);
    expect(parser.buffer()).toBe('');
  });

  it('hoppar över händelser helt utan data', () => {
    const { events, parser } = collect();
    parser.push('event: ping\n\n');
    expect(events).toHaveLength(0);
  });
});

/** En svarskropp som skickar chunkarna och sedan stänger, som en riktig SSE-ström. */
function streamOf(chunks: string[]): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
        controller.close();
      },
    }),
  );
}

describe('consumeSseStream', () => {
  it('stänger inte strömmen när konsumenten kastar på en händelse', async () => {
    const seen: unknown[] = [];
    const errors: unknown[] = [];
    let closed = false;

    await consumeSseStream(streamOf(['data: ett\n\n', 'data: två\n\n']), {
      onMessage: (_event, parsed) => {
        seen.push(parsed);
        if (parsed === 'ett') throw new Error('konsumenten kastade');
      },
      onError: (error) => errors.push(error),
      onClose: () => {
        closed = true;
      },
    });

    // Båda händelserna kom fram: en händelse som inte gick att hantera får inte tysta körningen.
    expect(seen).toEqual(['ett', 'två']);
    expect(errors).toHaveLength(1);
    expect((errors[0] as Error).message).toBe('konsumenten kastade');
    expect(closed).toBe(true);
  });
});
