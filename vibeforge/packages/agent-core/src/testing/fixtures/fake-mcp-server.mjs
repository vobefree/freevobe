#!/usr/bin/env node
/**
 * Minimal MCP-server över stdio som används i VibeForges tester.
 * Implementerar initialize, tools/list, tools/call, resources/list och prompts/list.
 */
import readline from 'node:readline';

const PROTOCOL_VERSION = '2025-11-25';

const TOOLS = [
  {
    name: 'echo',
    description: 'Ekar tillbaka texten.',
    inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
  },
  {
    name: 'sum',
    description: 'Summerar två tal.',
    inputSchema: {
      type: 'object',
      properties: { a: { type: 'number' }, b: { type: 'number' } },
      required: ['a', 'b'],
    },
  },
];

const rl = readline.createInterface({ input: process.stdin });

rl.on('line', (line) => {
  const trimmed = line.trim();
  if (trimmed === '') return;

  let message;
  try {
    message = JSON.parse(trimmed);
  } catch {
    return;
  }

  const reply = (result) => {
    process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id: message.id, result })}\n`);
  };
  const replyError = (code, text) => {
    process.stdout.write(
      `${JSON.stringify({ jsonrpc: '2.0', id: message.id, error: { code, message: text } })}\n`,
    );
  };

  switch (message.method) {
    case 'initialize':
      reply({
        protocolVersion:
          message.params?.protocolVersion === PROTOCOL_VERSION
            ? PROTOCOL_VERSION
            : PROTOCOL_VERSION,
        capabilities: { tools: {}, resources: {}, prompts: {} },
        serverInfo: { name: 'fake-mcp', version: '1.2.3' },
      });
      return;
    case 'notifications/initialized':
      return;
    case 'tools/list':
      reply({ tools: TOOLS });
      return;
    case 'tools/call': {
      const name = message.params?.name;
      const args = message.params?.arguments ?? {};
      if (name === 'echo') {
        reply({ content: [{ type: 'text', text: String(args.text ?? '') }], isError: false });
        return;
      }
      if (name === 'sum') {
        reply({
          content: [{ type: 'text', text: String(Number(args.a ?? 0) + Number(args.b ?? 0)) }],
          isError: false,
        });
        return;
      }
      reply({ content: [{ type: 'text', text: `okänt verktyg: ${name}` }], isError: true });
      return;
    }
    case 'resources/list':
      reply({
        resources: [{ uri: 'file:///README.md', name: 'README', mimeType: 'text/markdown' }],
      });
      return;
    case 'resources/read':
      reply({
        contents: [{ uri: message.params?.uri, mimeType: 'text/markdown', text: '# Läs mig' }],
      });
      return;
    case 'prompts/list':
      reply({ prompts: [{ name: 'granska', description: 'Granska en diff' }] });
      return;
    case 'prompts/get':
      reply({
        description: 'Granska',
        messages: [{ role: 'user', content: { type: 'text', text: 'Granska koden.' } }],
      });
      return;
    default:
      replyError(-32601, `Metoden ${message.method} stöds inte.`);
  }
});

process.stdin.on('end', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
