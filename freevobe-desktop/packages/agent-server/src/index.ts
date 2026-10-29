import { AGENT_SERVER_PORT } from '@freevobe/protocol';
import { PlaywrightBrowserDriver } from './browser/playwrightDriver.js';
import { AgentSessionHub } from './sessionHub.js';
import { startAgentServer } from './server.js';

export * from './server.js';
export * from './sessionHub.js';
export * from './projectService.js';
export * from './routes.js';
export { PlaywrightBrowserDriver, playwrightAvailable } from './browser/playwrightDriver.js';

/**
 * Startar Freevobe-agenten. Anropas av skrivbordsappens sidecar (utan argument) eller
 * manuellt under utveckling (`npm run dev:server`).
 */
export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  const devMode =
    process.env.FREEVOBE_DEV === '1' ||
    process.env.NODE_ENV !== 'production' ||
    process.env.FREEVOBE_E2E === '1';
  const port = Number(
    process.env.FREEVOBE_PORT ??
      argv.find((arg) => arg.startsWith('--port='))?.split('=')[1] ??
      AGENT_SERVER_PORT,
  );
  const host = process.env.FREEVOBE_HOST ?? '127.0.0.1';

  const hub = new AgentSessionHub({
    ...(process.env.FREEVOBE_HOME ? { home: process.env.FREEVOBE_HOME } : {}),
    ...(process.env.FREEVOBE_E2E === '1' ? { dbFile: ':memory:' } : {}),
    createBrowserDriver: () => new PlaywrightBrowserDriver({ headless: true }),
  });

  const handle = await startAgentServer({ hub, port, host, devMode });

  const info = {
    event: 'ready',
    url: handle.url,
    port: handle.port,
    pid: process.pid,
    database: hub.databaseFile,
    devMode,
  };
  // Skrivs på stdout så att Tauri-skalet (och utvecklaren) vet att servern är redo.
  process.stdout.write(`${JSON.stringify(info)}\n`);

  const shutdown = async (signal: string): Promise<void> => {
    process.stdout.write(`${JSON.stringify({ event: 'shutdown', signal })}\n`);
    await handle.close();
    hub.close();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

const isDirectRun =
  process.argv[1] !== undefined && /(\/|\\)index\.(ts|js|mjs)$/.test(process.argv[1]);
if (isDirectRun) {
  main().catch((error: unknown) => {
    process.stderr.write(
      `Freevobe-agenten kunde inte starta: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exit(1);
  });
}
