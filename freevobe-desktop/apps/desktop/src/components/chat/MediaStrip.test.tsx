// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { MediaAsset } from '@freevobe/protocol';
import { MediaStrip } from './MediaStrip';
import { useAppStore } from '../../store/appStore';

const image: MediaAsset = {
  path: '.freevobe/media/image-1.png',
  kind: 'image',
  mime: 'image/png',
  bytes: 2048,
  createdAt: 1,
  provider: 'google',
  model: 'gemini-3.1-flash-image',
  prompt: 'En räv i skogen',
  costUsd: 0.02,
};

describe('MediaStrip i chatten', () => {
  beforeEach(() => {
    useAppStore.setState({ client: null, project: null, mediaAssets: [image] });
  });

  afterEach(() => {
    cleanup();
    useAppStore.setState({ mediaAssets: [] });
  });

  it('visar ett kort per skapad fil', () => {
    render(<MediaStrip files={['.freevobe/media/image-1.png']} />);
    expect(screen.getByTestId('media-strip')).toBeTruthy();
    expect(screen.getAllByTestId('media-tile')).toHaveLength(1);
  });

  it('använder metadata från medielistan', () => {
    render(<MediaStrip files={['.freevobe/media/image-1.png']} />);
    const text = screen.getByTestId('media-strip').textContent ?? '';
    expect(text).toContain('Skapad media');
    expect(text).toContain('google · gemini-3.1-flash-image');
    expect(text).toContain('En räv i skogen');
  });

  it('gissar sorten ur filändelsen när metadata saknas', () => {
    render(<MediaStrip files={['.freevobe/media/klipp.mp4', '.freevobe/media/ljud.mp3']} />);
    const kinds = screen.getAllByTestId('media-tile').map((tile) => tile.dataset.kind);
    expect(kinds).toEqual(['video', 'audio']);
  });

  it('renderar ingenting utan filer', () => {
    const { container } = render(<MediaStrip files={[]} />);
    expect(container.querySelector('[data-testid="media-strip"]')).toBeNull();
  });
});
