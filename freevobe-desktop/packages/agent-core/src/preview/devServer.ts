import { spawn, type ChildProcess } from 'node:child_process';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import path from 'node:path';
import type { DevServerDetection, PreviewKind, PreviewStatus } from '@freevobe/protocol';

/**
 * Live-preview: hittar projektets dev-server, startar den och ger en adress som gränssnittet kan
 * visa i en iframe. Servern binder alltid till loopback – ingenting exponeras mot nätverket – och
 * processen dödas när sessionen stängs.
 */

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.ts': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

interface PackageJsonLike {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

function readPackage(packageJson: unknown): PackageJsonLike {
  return typeof packageJson === 'object' && packageJson !== null
    ? (packageJson as PackageJsonLike)
    : {};
}

function hasDependency(pkg: PackageJsonLike, name: string): boolean {
  return Boolean(pkg.dependencies?.[name] ?? pkg.devDependencies?.[name]);
}

/**
 * Avgör hur projektet startas. Ett dev-skript vinner över statiska filer: en React-app har alltid
 * en index.html, men den behöver sin server för att fungera.
 */
export function detectDevServer(input: {
  files: string[];
  packageJson?: unknown;
}): DevServerDetection {
  const pkg = readPackage(input.packageJson);
  const files = input.files.map((file) => file.replace(/\\/g, '/'));
  const devScript = pkg.scripts?.dev?.trim();

  if (devScript) {
    const kind: PreviewKind = hasDependency(pkg, 'next')
      ? 'next'
      : hasDependency(pkg, 'nuxt')
        ? 'nuxt'
        : hasDependency(pkg, 'astro')
          ? 'astro'
          : hasDependency(pkg, '@sveltejs/kit')
            ? 'svelte'
            : hasDependency(pkg, 'vite')
              ? 'vite'
              : 'npm-dev';
    const expectedPort = kind === 'next' ? 3000 : kind === 'vite' ? 5173 : null;
    return {
      kind,
      command: 'npm',
      args: ['run', 'dev'],
      url: expectedPort === null ? null : `http://127.0.0.1:${expectedPort}`,
      source: 'package.json',
    };
  }

  if (files.some((file) => /(^|\/)index\.html?$/i.test(file))) {
    return { kind: 'static', command: null, args: [], url: null, source: 'index.html' };
  }

  return { kind: null, command: null, args: [], url: null, source: 'none' };
}

/** Plockar ut adressen ur en dev-servers logg, t.ex. Vites `Local: http://localhost:5173/`. */
export function extractPreviewUrl(output: string): string | null {
  const match = /https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::(\d{2,5}))?\/?/i.exec(output);
  if (!match) return null;
  // Gränssnittet körs i en annan kontext än serverns webbläsare; 127.0.0.1 undviker att
  // localhost pekar fel på maskiner där IPv6 är standard.
  const port = match[1] ?? '80';
  return `http://127.0.0.1:${port}/`;
}

/** Sant när adressen pekar på loopback. Preview får aldrig exponeras utåt. */
export function isLoopbackUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return (
      parsed.protocol === 'http:' &&
      (parsed.hostname === '127.0.0.1' ||
        parsed.hostname === 'localhost' ||
        parsed.hostname === '::1' ||
        parsed.hostname === '[::1]')
    );
  } catch {
    return false;
  }
}

/**
 * Argument som binder dev-servern till loopback på den port previewn väntar på. Utan dem binder
 * Vite 7 till `localhost`, som på många maskiner blir IPv6 (::1) – då svarar aldrig probe-anropet
 * mot 127.0.0.1 och previewn tidsutgår. `--strictPort` gör att en upptagen port syns som ett fel i
 * stället för att servern tyst byter port.
 */
export function previewArgs(detection: DevServerDetection, port: number): string[] {
  const args = [...detection.args];
  switch (detection.kind) {
    case 'vite':
    case 'svelte':
      return [...args, '--', '--host', '127.0.0.1', '--port', String(port), '--strictPort'];
    case 'next':
      return [...args, '--', '-H', '127.0.0.1', '-p', String(port)];
    case 'nuxt':
    case 'astro':
      return [...args, '--', '--host', '127.0.0.1', '--port', String(port)];
    default:
      return args;
  }
}

/** Samma adress med båda loopback-namnen, så att IPv4/IPv6-val inte avgör om previewn syns. */
export function loopbackVariants(url: string): string[] {
  try {
    const parsed = new URL(url);
    const variants = [url];
    for (const host of ['127.0.0.1', 'localhost']) {
      if (parsed.hostname === host) continue;
      const copy = new URL(url);
      copy.hostname = host;
      variants.push(copy.toString());
    }
    return variants;
  } catch {
    return [url];
  }
}

export interface StaticPreviewOptions {
  root: string;
  /** Port 0 låter operativsystemet välja en ledig port. */
  port?: number;
  host?: string;
}

export interface PreviewHandle {
  url: string;
  port: number;
  status: PreviewStatus;
  close: () => Promise<void>;
  /** Uppdaterad status, inklusive loggens sista rader. */
  snapshot: () => PreviewStatus;
}

/** Servar statiska filer direkt från projektet. Ingen byggnad, inga beroenden, bara loopback. */
export async function startStaticPreview(options: StaticPreviewOptions): Promise<PreviewHandle> {
  const root = path.resolve(options.root);
  const host = options.host ?? '127.0.0.1';
  const logTail: string[] = [];

  const server: Server = createServer((request, response) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Endast GET.');
      return;
    }

    const requested = decodeURIComponent((request.url ?? '/').split('?')[0] ?? '/');
    const relative = requested === '/' ? 'index.html' : requested.replace(/^\/+/, '');
    const absolute = path.resolve(root, relative);

    // Sökvägen måste ligga innanför projektet. `..` och absoluta sökvägar avvisas.
    if (absolute !== root && !absolute.startsWith(`${root}${path.sep}`)) {
      response.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Utanför projektet.');
      return;
    }

    void fs
      .stat(absolute)
      .then((stat) => {
        const file = stat.isDirectory() ? path.join(absolute, 'index.html') : absolute;
        return fs.stat(file).then((inner) => ({ file, inner }));
      })
      .then(({ file, inner }) => {
        if (!inner.isFile()) throw new Error('inte en fil');
        const type = MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
        response.writeHead(200, {
          'content-type': type,
          'cache-control': 'no-store',
        });
        if (request.method === 'HEAD') {
          response.end();
          return;
        }
        createReadStream(file).pipe(response);
      })
      .catch(() => {
        response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
        response.end('Hittades inte.');
      });
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(options.port ?? 0, host, () => resolve());
  });

  const address = server.address();
  const port = typeof address === 'object' && address !== null ? address.port : 0;
  const url = `http://${host}:${port}/`;
  logTail.push(`Statisk server på ${url}`);

  const snapshot = (): PreviewStatus => ({
    status: 'running',
    kind: 'static',
    command: null,
    url,
    port,
    logTail: [...logTail].slice(-40),
  });

  return {
    url,
    port,
    status: snapshot(),
    snapshot,
    close: async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

export interface DevPreviewOptions {
  root: string;
  detection: DevServerDetection;
  /** Port som skickas i `PORT`. Vite och Next lyssnar på den när argumenten tillåter. */
  port?: number;
  startTimeoutMs?: number;
  spawnImpl?: typeof spawn;
  probe?: (url: string) => Promise<boolean>;
  /** Standard: stäng av processen när sessionen stängs. */
  onExit?: (code: number | null) => void;
}

/** Startar ett dev-skript, väntar på att det svarar och returnerar en stängbar preview. */
export async function startDevPreview(options: DevPreviewOptions): Promise<PreviewHandle> {
  if (!options.detection.command) throw new Error('Projektet har ingen dev-server.');
  const port = options.port ?? 5173;
  const spawnImpl = options.spawnImpl ?? spawn;
  const logTail: string[] = [];
  let url: string | null = options.detection.url;
  let lastError: string | null = null;

  const args = previewArgs(options.detection, port);
  const child: ChildProcess = spawnImpl(options.detection.command, args, {
    cwd: options.root,
    env: { ...process.env, PORT: String(port), BROWSER: 'none' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const collect = (chunk: unknown): void => {
    const text = String(chunk);
    logTail.push(...text.split('\n').filter((line) => line.trim() !== ''));
    if (logTail.length > 200) logTail.splice(0, logTail.length - 200);
    const found = extractPreviewUrl(text);
    if (found) url = found;
  };
  child.stdout?.on('data', collect);
  child.stderr?.on('data', collect);

  const probe =
    options.probe ??
    (async (candidate: string) => {
      try {
        const response = await fetch(candidate, { signal: AbortSignal.timeout(1_500) });
        return response.ok || response.status < 500;
      } catch {
        return false;
      }
    });

  const deadline = Date.now() + (options.startTimeoutMs ?? 30_000);
  let readyUrl: string | null = null;
  while (Date.now() < deadline) {
    for (const candidate of url ? loopbackVariants(url) : []) {
      if (await probe(candidate)) {
        readyUrl = candidate;
        break;
      }
    }
    if (readyUrl) break;
    if (child.exitCode !== null) {
      lastError = `Dev-servern avslutades med kod ${child.exitCode}.`;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 350));
  }

  if (!readyUrl || lastError !== null) {
    child.kill('SIGTERM');
    throw new Error(
      lastError ??
        'Dev-servern svarade inte inom tidsgränsen. Kontrollera att den binder till 127.0.0.1.',
    );
  }
  url = readyUrl;

  const finalUrl = readyUrl;
  const finalPort = Number(new URL(finalUrl).port || 80);
  const snapshot = (): PreviewStatus => ({
    status: 'running',
    kind: options.detection.kind,
    command: `${options.detection.command ?? ''} ${args.join(' ')}`.trim(),
    url: finalUrl,
    port: finalPort,
    logTail: [...logTail].slice(-40),
  });

  return {
    url: finalUrl,
    port: finalPort,
    status: snapshot(),
    snapshot,
    close: async () => {
      child.kill('SIGTERM');
      options.onExit?.(child.exitCode);
      await new Promise((resolve) => setTimeout(resolve, 150));
      if (child.exitCode === null) child.kill('SIGKILL');
    },
  };
}
