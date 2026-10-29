#!/usr/bin/env node
/**
 * Fejkad Ollama för E2E-testerna. Svarar på de endpoints Freevobe använder och spelar upp
 * en förutbestämd turordning: läs en fil, skriv en ny fil, sammanfatta.
 *
 * Den här servern kör bara i tester och används för att kunna verifiera hela kedjan
 * prompt → verktygsanrop → godkännande → diff → skrivning utan en riktig modell.
 *
 *   node e2e/fixtures/fake-ollama.mjs [--port=4399]
 */
import http from 'node:http';

const portArg = process.argv.find((arg) => arg.startsWith('--port='));
const port = Number(portArg?.split('=')[1] ?? 4399);

const MODEL = {
  name: 'freevobe-fake-coder:latest',
  size: 4_200_000_000,
  modified_at: '2026-10-20T09:00:00Z',
  details: { parameter_size: '7B', quantization_level: 'Q4_K_M', family: 'fake' },
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function sendJson(response, status, body) {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(payload),
  });
  response.end(payload);
}

function sse(response) {
  response.writeHead(200, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-cache',
    connection: 'keep-alive',
  });
  return {
    write(event) {
      response.write(`data: ${JSON.stringify(event)}\n\n`);
    },
    done() {
      response.write('data: [DONE]\n\n');
      response.end();
    },
  };
}

function contentEvent(text) {
  return { choices: [{ delta: { content: text }, finish_reason: null }] };
}

function toolEvent({ index = 0, id, name, args }) {
  return {
    choices: [
      {
        delta: {
          tool_calls: [
            {
              index,
              ...(id ? { id } : {}),
              function: { ...(name ? { name } : {}), arguments: args ?? '' },
            },
          ],
        },
        finish_reason: null,
      },
    ],
  };
}

/**
 * Turordningen i Execute-läget: (1) läs package.json, (2) skriv src/hello.ts, (3) sammanfatta.
 * I Plan-läget lägger modellen i stället fram en plan med `propose_plan` – det är den enda
 * turen som behövs, eftersom planen avslutar körningen.
 */
async function scriptedTurns(body, stream) {
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const toolResults = messages.filter((message) => message.role === 'tool').length;
  const systemPrompt = messages.find((message) => message.role === 'system')?.content ?? '';
  const planMode = typeof systemPrompt === 'string' && systemPrompt.includes('Du är i Plan-läget');
  // Unika anrops-id per tur, precis som en riktig modell.
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

  if (planMode && toolResults === 0) {
    const plan = {
      title: 'Skapa src/hello.ts',
      summary: 'En liten fil med en hälsning, enligt package.json.',
      steps: [
        { title: 'Läs package.json', files: ['package.json'] },
        { title: 'Skriv src/hello.ts', files: ['src/hello.ts'] },
      ],
      files: ['src/hello.ts'],
    };
    const args = JSON.stringify(plan);
    stream.write(toolEvent({ id: `call_plan_${suffix}`, name: 'propose_plan', args: '' }));
    await sleep(10);
    stream.write(toolEvent({ args: args.slice(0, 40) }));
    await sleep(10);
    stream.write(toolEvent({ args: args.slice(40) }));
    await sleep(10);
    stream.write({ choices: [{ delta: {}, finish_reason: 'tool_calls' }] });
    return;
  }

  if (toolResults === 0) {
    stream.write(toolEvent({ id: `call_read_${suffix}`, name: 'read_file', args: '' }));
    await sleep(10);
    stream.write(toolEvent({ args: '{"path":"package.json"}' }));
    await sleep(10);
    stream.write({ choices: [{ delta: {}, finish_reason: 'tool_calls' }] });
    return;
  }

  if (toolResults === 1) {
    const created = 'export const hello = "freevobe";\n';
    const args = JSON.stringify({ path: 'src/hello.ts', content: created });
    stream.write(toolEvent({ id: `call_write_${suffix}`, name: 'write_file', args: '' }));
    await sleep(10);
    // Argumenten kommer i bitar, precis som en riktig modell gör.
    stream.write(toolEvent({ args: args.slice(0, 22) }));
    await sleep(10);
    stream.write(toolEvent({ args: args.slice(22) }));
    await sleep(10);
    stream.write({ choices: [{ delta: {}, finish_reason: 'tool_calls' }] });
    return;
  }

  stream.write({ usage: { prompt_tokens: 128, completion_tokens: 24 } });
  stream.write(contentEvent('Klart. '));
  await sleep(10);
  stream.write(contentEvent('Jag skapade src/hello.ts med en hälsning.'));
  await sleep(10);
  stream.write({ choices: [{ delta: {}, finish_reason: 'stop' }] });
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://127.0.0.1:${port}`);

  if (request.method === 'GET' && url.pathname === '/api/version') {
    return sendJson(response, 200, { version: '0.0.0-fake' });
  }

  if (request.method === 'GET' && url.pathname === '/api/tags') {
    return sendJson(response, 200, { models: [MODEL] });
  }

  if (request.method === 'POST' && url.pathname === '/api/show') {
    return sendJson(response, 200, {
      capabilities: ['completion', 'tools'],
      model_info: { 'fake.context_length': 32768 },
      details: MODEL.details,
    });
  }

  if (request.method === 'POST' && url.pathname === '/v1/chat/completions') {
    let raw = '';
    for await (const chunk of request) raw += chunk;
    let body = {};
    try {
      body = JSON.parse(raw);
    } catch {
      return sendJson(response, 400, { error: { message: 'Trasig JSON.' } });
    }

    if (body.stream === false) {
      return sendJson(response, 200, {
        choices: [{ message: { role: 'assistant', content: 'Klart.' }, finish_reason: 'stop' }],
      });
    }

    const stream = sse(response);
    try {
      await scriptedTurns(body, stream);
    } catch (error) {
      stream.write({ error: { message: error instanceof Error ? error.message : String(error) } });
    }
    stream.done();
    return;
  }

  sendJson(response, 404, {
    error: { message: `Ingen rutt för ${request.method} ${url.pathname}` },
  });
});

server.listen(port, '127.0.0.1', () => {
  process.stdout.write(`${JSON.stringify({ event: 'ready', url: `http://127.0.0.1:${port}` })}\n`);
});
