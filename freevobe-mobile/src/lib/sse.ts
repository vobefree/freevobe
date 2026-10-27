/**
 * Server-Sent Events utan polyfill.
 *
 * React Native har ingen inbyggd `EventSource`, och den kan inte skicka egna huvuden – vilket krävs
 * för parningstoken. I stället läser vi strömmen själva. Sedan SDK 58 är `expo/fetch` installerad som
 * global `fetch` på iOS och Android, och den stöder `response.body.getReader()`; på webben gör
 * webbläsarens fetch samma sak. Därför räcker det med `globalThis.fetch`.
 *
 * Nätverkschunkar följer inte händelsegränserna, så parsern buffrar och delar på tom rad. Det är den
 * enda delen som är lätt att få fel på, och därför är den här filen ren och enhetstestad.
 */

export interface SseEvent {
  /** Värdet från `event:`-raden; tom sträng om servern inte skickade någon. */
  event: string;
  /** Sammanslagna `data:`-rader, utan avslutande radbrytning. */
  data: string;
}

export interface SseParser {
  /** Mata in en chunk. Anropar `onEvent` för varje komplett händelse i bufferten. */
  push(chunk: string): void;
  /** Avsluta strömmen: en sista händelse utan avslutande tom rad ska ändå levereras. */
  flush(): void;
  /** Kvarglömd text (för felsökning och tester). */
  buffer(): string;
}

/**
 * Tål både `\n\n` och `\r\n\r\n` som avgränsare, ignorerar kommentarsrader (`:`-prefixed, används som
 * keep-alive) och hoppar över händelser helt utan data.
 */
export function createSseParser(onEvent: (event: SseEvent) => void): SseParser {
  let buffer = '';

  const emit = (raw: string) => {
    const lines = raw.split(/\r?\n/);
    let event = '';
    const data: string[] = [];

    for (const line of lines) {
      if (line === '' || line.startsWith(':')) continue;
      const colon = line.indexOf(':');
      const field = colon === -1 ? line : line.slice(0, colon);
      // Ett enda blanksteg efter kolon är en del av protokollet och tas bort.
      let value = colon === -1 ? '' : line.slice(colon + 1);
      if (value.startsWith(' ')) value = value.slice(1);

      if (field === 'event') event = value;
      else if (field === 'data') data.push(value);
    }

    if (data.length > 0) onEvent({ event, data: data.join('\n') });
  };

  const drain = (final: boolean) => {
    for (;;) {
      const match = /\r?\n\r?\n/.exec(buffer);
      if (!match) break;
      const raw = buffer.slice(0, match.index);
      buffer = buffer.slice(match.index + match[0].length);
      emit(raw);
    }
    if (final && buffer.trim() !== '') {
      emit(buffer);
      buffer = '';
    }
  };

  return {
    push(chunk: string) {
      buffer += chunk;
      drain(false);
    },
    flush() {
      drain(true);
    },
    buffer: () => buffer,
  };
}

export interface SseHandlers {
  /** Anropas för varje händelse med JSON-parsad data. Ogiltig JSON hoppas över. */
  onMessage?: (event: SseEvent, parsed: unknown) => void;
  onError?: (error: unknown) => void;
  /** Anropas när strömmen tar slut (servern stängde eller vi avbröt). */
  onClose?: () => void;
}

/**
 * Läser en SSE-ström till slut. `signal` avbryter anslutningen, vilket är så mobilappen stoppar en
 * körning när användaren lämnar skärmen.
 */
export async function consumeSseStream(
  response: Response,
  handlers: SseHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const body = response.body as ReadableStream<Uint8Array> | null | undefined;
  if (!body || typeof body.getReader !== 'function') {
    throw new Error('Svarskroppen kan inte strömmas (response.body.getReader saknas).');
  }

  const reader = body.getReader();
  const decoder = new TextDecoder();
  const parser = createSseParser((event) => {
    let parsed: unknown = event.data;
    try {
      parsed = JSON.parse(event.data);
    } catch {
      // Servern kan skicka vanlig text (t.ex. ": ansluten"); den levereras oparsad.
    }
    // Ett fel hos konsumenten får inte stänga strömmen: då skulle en enda trasig händelse tysta
    // resten av körningen. Felet rapporteras vidare och nästa händelse hanteras som vanligt.
    try {
      handlers.onMessage?.(event, parsed);
    } catch (error) {
      handlers.onError?.(error);
    }
  });

  const onAbort = () => {
    void reader.cancel().catch(() => undefined);
  };
  signal?.addEventListener('abort', onAbort);

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) parser.push(decoder.decode(value, { stream: true }));
    }
    parser.push(decoder.decode());
    parser.flush();
  } catch (error) {
    handlers.onError?.(error);
  } finally {
    signal?.removeEventListener('abort', onAbort);
    handlers.onClose?.();
  }
}
