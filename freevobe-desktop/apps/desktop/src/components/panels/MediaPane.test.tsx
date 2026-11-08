// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { MediaAsset } from '@freevobe/protocol';
import { MediaPane } from './MediaPane';
import { useAppStore } from '../../store/appStore';

const image: MediaAsset = {
  path: '.freevobe/media/image-1.png',
  kind: 'image',
  mime: 'image/png',
  bytes: 2048,
  createdAt: 3,
  provider: 'google',
  model: 'gemini-3.1-flash-image',
  prompt: 'En räv i skogen',
  costUsd: 0.02,
};

const video: MediaAsset = {
  path: '.freevobe/media/video-1.mp4',
  kind: 'video',
  mime: 'video/mp4',
  bytes: 4096,
  createdAt: 2,
};

describe('MediaPane', () => {
  let loadMedia: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    loadMedia = vi.fn(async () => undefined);
    useAppStore.setState({
      project: { id: 'project-1' } as never,
      mediaAssets: [],
      mediaLoading: false,
      mediaError: null,
      mediaResults: [],
      loadMedia: loadMedia as never,
    });
  });

  afterEach(() => {
    cleanup();
    useAppStore.setState({
      project: null,
      mediaAssets: [],
      mediaResults: [],
      settings: null,
    });
  });

  it('läser mappen när fliken öppnas', () => {
    render(<MediaPane />);
    expect(loadMedia).toHaveBeenCalled();
  });

  it('visar en förklaring när inget har skapats än', () => {
    render(<MediaPane />);
    expect(screen.getByTestId('media-pane').textContent).toContain('Ingen media än');
  });

  it('visar ett kort per fil med provider, storlek och kostnad', () => {
    useAppStore.setState({ mediaAssets: [image, video] });
    render(<MediaPane />);

    const tiles = screen.getAllByTestId('media-tile');
    expect(tiles).toHaveLength(2);
    const text = screen.getByTestId('media-grid').textContent ?? '';
    expect(text).toContain('image-1.png');
    expect(text).toContain('google · gemini-3.1-flash-image');
    expect(text).toContain('En räv i skogen');
    expect(text).toContain('$0.02');
    expect(text).toContain('Bild');
    expect(text).toContain('Video');
  });

  it('visar total kostnad, dagens kostnad och kvarvarande budget', () => {
    useAppStore.setState({
      mediaAssets: [image, { ...image, path: '.freevobe/media/image-2.png', createdAt: Date.now() }],
      settings: { mediaDailyBudgetUsd: 1 } as never,
    });
    render(<MediaPane />);

    const spend = screen.getByTestId('media-spend').textContent ?? '';
    expect(spend).toContain('Totalt $0.04');
    expect(spend).toContain('Idag $0.02');
    expect(spend).toContain('$0.98');
  });

  it('säger till när dagens budget är slut', () => {
    useAppStore.setState({
      mediaAssets: [{ ...image, createdAt: Date.now() }],
      settings: { mediaDailyBudgetUsd: 0.01 } as never,
    });
    render(<MediaPane />);

    expect(screen.getByTestId('media-spend').textContent).toContain(
      'Dagens mediabudget är slut',
    );
  });

  it('visar felmeddelandet när mappen inte kunde läsas', () => {
    useAppStore.setState({ mediaError: 'Kunde inte läsa media-mappen.' });
    render(<MediaPane />);
    expect(screen.getByTestId('media-pane').textContent).toContain(
      'Kunde inte läsa media-mappen.',
    );
  });
});
