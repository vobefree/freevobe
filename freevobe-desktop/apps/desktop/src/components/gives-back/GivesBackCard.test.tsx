// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DEFAULT_AUTO_APPROVE, GIVES_BACK_CAUSES, causeForPrompt } from '@freevobe/protocol';
import type { AppSettings } from '@freevobe/protocol';
import { GivesBackCard } from './GivesBackCard';
import { useAppStore } from '../../store/appStore';

function settingsWith(givesBack: Partial<AppSettings['givesBack']> = {}): AppSettings {
  return {
    ollamaBaseUrl: 'http://localhost:11434',
    defaultModel: 'qwen2.5-coder:7b',
    permissionMode: 'ask',
    autoApprove: { ...DEFAULT_AUTO_APPROVE },
    theme: 'dark',
    contextBudgetChars: 24_000,
    maxIterations: 12,
    telemetry: false,
    allowCloudServices: false,
    givesBack: { enabled: true, everyNPrompts: 10, causeIds: [], ...givesBack },
    browserAutomationEnabled: false,
    verifyAfterRun: true,
    updatedAt: Date.now(),
  };
}

describe('GivesBackCard', () => {
  beforeEach(() => {
    useAppStore.setState({ settings: settingsWith() });
  });

  afterEach(() => {
    cleanup();
    useAppStore.setState({ settings: null });
  });

  it('visar ingenting innan den tionde prompten', () => {
    render(<GivesBackCard promptIndex={9} />);
    expect(screen.queryByTestId('gives-back-card')).toBeNull();
  });

  it('visar ett ändamål med en tydlig märkning vid var tionde prompt', () => {
    render(<GivesBackCard promptIndex={10} />);
    expect(screen.getByTestId('gives-back-card')).toBeTruthy();
    expect(screen.getByText('Gives Back')).toBeTruthy();
    expect(screen.getByText(/inga pengar går genom Freevobe/)).toBeTruthy();
    expect(screen.getAllByRole('complementary', { name: 'Freevobe Gives Back' })).toHaveLength(1);
  });

  it('visar ingenting när användaren inte slagit på Gives Back', () => {
    useAppStore.setState({ settings: settingsWith({ enabled: false }) });
    render(<GivesBackCard promptIndex={10} />);
    expect(screen.queryByTestId('gives-back-card')).toBeNull();
  });

  it('följer användarens intervall', () => {
    useAppStore.setState({ settings: settingsWith({ everyNPrompts: 5 }) });
    const { rerender } = render(<GivesBackCard promptIndex={5} />);
    expect(screen.getByTestId('gives-back-card')).toBeTruthy();
    rerender(<GivesBackCard promptIndex={6} />);
    expect(screen.queryByTestId('gives-back-card')).toBeNull();
  });

  it('länkar till organisationens egen sida i en ny flik', () => {
    render(<GivesBackCard promptIndex={10} />);
    const link = screen.getByTestId('gives-back-open') as HTMLAnchorElement;
    const cause = GIVES_BACK_CAUSES.find((entry) => link.textContent === `Öppna ${entry.name}`);
    expect(cause).toBeTruthy();
    expect(link.getAttribute('href')).toBe(cause?.url);
    expect(link.rel).toContain('noopener');
    expect(link.target).toBe('_blank');
  });

  it('registrerar ett eget stöd i den lokala loggen', async () => {
    const logContribution = vi.fn().mockResolvedValue(undefined);
    useAppStore.setState({ logContribution });
    render(<GivesBackCard promptIndex={10} />);

    fireEvent.click(screen.getByTestId('gives-back-log'));
    fireEvent.change(screen.getByTestId('gives-back-amount'), { target: { value: '250' } });
    fireEvent.change(screen.getByTestId('gives-back-note'), { target: { value: 'Skog' } });
    fireEvent.click(screen.getByTestId('gives-back-submit'));

    await waitFor(() => expect(logContribution).toHaveBeenCalledTimes(1));
    expect(logContribution.mock.calls[0]?.[0]).toMatchObject({
      causeId: causeForPrompt(10, []).id,
      amountSek: 250,
      note: 'Skog',
    });
    expect(await screen.findByTestId('gives-back-saved')).toBeTruthy();
  });

  it('kan stängas för stunden utan att ändra inställningen', () => {
    render(<GivesBackCard promptIndex={10} />);
    fireEvent.click(screen.getByTestId('gives-back-dismiss'));
    expect(screen.queryByTestId('gives-back-card')).toBeNull();
    expect(useAppStore.getState().settings?.givesBack.enabled).toBe(true);
  });
});
