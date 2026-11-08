import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  detectDevServer,
  extractPreviewUrl,
  isLoopbackUrl,
  loopbackVariants,
  previewArgs,
  startStaticPreview,
  type PreviewHandle,
} from './devServer.js';

const handles: PreviewHandle[] = [];

afterEach(async () => {
  await Promise.all(handles.splice(0).map((handle) => handle.close()));
});

describe('dev-server', () => {
  it('hittar ramverkets dev-skript och förväntad adress', () => {
    const next = detectDevServer({
      files: ['index.html'],
      packageJson: { dependencies: { next: '15' }, scripts: { dev: 'next dev' } },
    });
    expect(next.kind).toBe('next');
    expect(next.command).toBe('npm');
    expect(next.args).toEqual(['run', 'dev']);
    expect(next.url).toBe('http://127.0.0.1:3000');

    const vite = detectDevServer({
      files: [],
      packageJson: { devDependencies: { vite: '5' }, scripts: { dev: 'vite' } },
    });
    expect(vite.kind).toBe('vite');
    expect(vite.url).toBe('http://127.0.0.1:5173');

    const plain = detectDevServer({
      files: [],
      packageJson: { scripts: { dev: 'node server.js' } },
    });
    expect(plain.kind).toBe('npm-dev');
    expect(plain.url).toBeNull();
  });

  it('servar statiska filer när inget dev-skript finns', () => {
    const detection = detectDevServer({ files: ['index.html'] });
    expect(detection.kind).toBe('static');
    expect(detection.command).toBeNull();
    expect(detectDevServer({ files: ['README.md'] }).kind).toBeNull();
  });

  it('binder dev-servern till loopback på förväntad port', () => {
    const vite = detectDevServer({
      files: [],
      packageJson: { devDependencies: { vite: '7' }, scripts: { dev: 'vite' } },
    });
    expect(previewArgs(vite, 5173)).toEqual([
      'run',
      'dev',
      '--',
      '--host',
      '127.0.0.1',
      '--port',
      '5173',
      '--strictPort',
    ]);

    const next = detectDevServer({
      files: [],
      packageJson: { dependencies: { next: '15' }, scripts: { dev: 'next dev' } },
    });
    expect(previewArgs(next, 3000)).toEqual(['run', 'dev', '--', '-H', '127.0.0.1', '-p', '3000']);

    const plain = detectDevServer({ files: [], packageJson: { scripts: { dev: 'node s.js' } } });
    expect(previewArgs(plain, 4000)).toEqual(['run', 'dev']);

    expect(loopbackVariants('http://127.0.0.1:5173/')).toEqual([
      'http://127.0.0.1:5173/',
      'http://localhost:5173/',
    ]);
  });

  it('plockar adressen ur loggen och kräver loopback', () => {
    expect(extractPreviewUrl('  ➜  Local:   http://localhost:5173/')).toBe(
      'http://127.0.0.1:5173/',
    );
    expect(extractPreviewUrl('ingen adress här')).toBeNull();
    expect(isLoopbackUrl('http://127.0.0.1:5173/')).toBe(true);
    expect(isLoopbackUrl('http://localhost:3000')).toBe(true);
    expect(isLoopbackUrl('http://192.168.1.4:3000')).toBe(false);
    expect(isLoopbackUrl('https://example.com')).toBe(false);
  });

  it('serverar index.html och stoppar sökvägar utanför projektet', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'freevobe-preview-'));
    await fs.writeFile(path.join(root, 'index.html'), '<h1>Hej</h1>');
    await fs.writeFile(path.join(root, 'style.css'), 'body{color:red}');
    const outside = path.join(root, '..', 'hemlig.txt');
    await fs.writeFile(outside, 'hemlig');

    const handle = await startStaticPreview({ root });
    handles.push(handle);
    expect(handle.url.startsWith('http://127.0.0.1:')).toBe(true);

    const index = await fetch(handle.url);
    expect(index.status).toBe(200);
    expect(index.headers.get('content-type')).toContain('text/html');
    expect(await index.text()).toContain('Hej');

    const css = await fetch(`${handle.url}style.css`);
    expect(css.headers.get('content-type')).toContain('text/css');

    const blocked = await fetch(`${handle.url}%2e%2e/hemlig.txt`);
    expect([403, 404]).toContain(blocked.status);

    const missing = await fetch(`${handle.url}saknas.txt`);
    expect(missing.status).toBe(404);
  });
});
