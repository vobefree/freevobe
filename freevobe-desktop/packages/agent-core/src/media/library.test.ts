import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MEDIA_DIR } from './service.js';
import { listMedia, mediaKindForMime, mimeForMediaFile, resolveMediaFile } from './library.js';

let root: string;

async function writeMedia(name: string, body = 'data', sidecar?: Record<string, unknown>) {
  const directory = path.join(root, MEDIA_DIR);
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, name), body);
  if (sidecar) {
    await fs.writeFile(path.join(directory, `${name}.json`), JSON.stringify(sidecar));
  }
}

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'freevobe-library-'));
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe('listMedia', () => {
  it('returnerar en tom lista när mappen saknas', async () => {
    expect(await listMedia(root)).toEqual([]);
  });

  it('listar bilder, video och ljud med metadata, nyast först', async () => {
    await writeMedia('audio-1.mp3', 'ljud', { createdAt: 10_000 });
    await writeMedia('image-1.png', 'bild', {
      provider: 'google',
      model: 'gemini-3.1-flash-image',
      prompt: 'En räv i skogen',
      costUsd: 0.02,
      createdAt: 20_000,
    });
    await writeMedia('video-1.mp4', 'video', { provider: 'xai', createdAt: 30_000 });

    const assets = await listMedia(root);

    expect(assets.map((asset) => asset.kind)).toEqual(['video', 'image', 'audio']);
    const image = assets[1];
    expect(image?.path).toBe(`${MEDIA_DIR}/image-1.png`);
    expect(image?.mime).toBe('image/png');
    expect(image?.provider).toBe('google');
    expect(image?.model).toBe('gemini-3.1-flash-image');
    expect(image?.prompt).toBe('En räv i skogen');
    expect(image?.costUsd).toBe(0.02);
    expect(image?.bytes).toBe(Buffer.byteLength('bild'));
  });

  it('ignorerar metadatafiler, dolda filer och okända typer', async () => {
    await writeMedia('image-1.png', 'bild', { createdAt: 1 });
    await writeMedia('anteckningar.txt', 'text');
    await writeMedia('.hidden.png', 'dold');

    const assets = await listMedia(root);
    expect(assets).toHaveLength(1);
    expect(assets[0]?.path.endsWith('image-1.png')).toBe(true);
  });

  it('visar filen även när metadatafilen saknas', async () => {
    await writeMedia('image-2.webp', 'bild');
    const [asset] = await listMedia(root);
    expect(asset?.kind).toBe('image');
    expect(asset?.mime).toBe('image/webp');
    expect(asset?.bytes).toBeGreaterThan(0);
    expect(asset?.provider).toBeUndefined();
  });
});

describe('resolveMediaFile', () => {
  it('släpper igenom filer i media-mappen', () => {
    const resolved = resolveMediaFile(root, `${MEDIA_DIR}/image-1.png`);
    expect(resolved.absolutePath).toBe(path.join(root, MEDIA_DIR, 'image-1.png'));
    expect(resolved.mime).toBe('image/png');
  });

  it('vägrar filer utanför media-mappen', () => {
    expect(() => resolveMediaFile(root, '.freevobe/hemlig.txt')).toThrow(/utanför/);
    expect(() => resolveMediaFile(root, '../utanfor.png')).toThrow(/utanför/);
    expect(() => resolveMediaFile(root, '/etc/passwd')).toThrow(/utanför/);
  });

  it('vägrar metadatafiler och okända typer', () => {
    expect(() => resolveMediaFile(root, `${MEDIA_DIR}/image-1.png.json`)).toThrow(/Metadatofiler/);
    expect(() => resolveMediaFile(root, `${MEDIA_DIR}/anteckningar.txt`)).toThrow(/inte en bild/);
  });
});

describe('mimeForMediaFile', () => {
  it('känner igen vanliga ändelser och faller tillbaka på binär', () => {
    expect(mimeForMediaFile('a.MP4')).toBe('video/mp4');
    expect(mimeForMediaFile('a.wav')).toBe('audio/wav');
    expect(mimeForMediaFile('a.bin')).toBe('application/octet-stream');
    expect(mediaKindForMime('audio/ogg')).toBe('audio');
    expect(mediaKindForMime('application/octet-stream')).toBeNull();
  });
});
