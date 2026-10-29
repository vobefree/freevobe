// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { OllamaProbeResult } from '@freevobe/protocol';
import { Onboarding } from './Onboarding';
import { useAppStore } from '../store/appStore';

/** Ollama saknas: det här är läget en helt ny installation är i innan användaren hunnit installera det. */
const offlineOllama: OllamaProbeResult = {
  available: false,
  baseUrl: 'http://localhost:11434',
  models: [],
  error: 'Ollama svarar inte på localhost:11434.',
  helpUrl: 'https://freevobe.dev/docs/ollama',
};

describe('Onboarding', () => {
  beforeEach(() => {
    useAppStore.setState({
      onboardingComplete: false,
      onboardingStep: 0,
      consentLocalData: false,
      consentGivesBack: false,
      ollama: offlineOllama,
      models: [],
      selectedModel: '',
      project: null,
    });
  });

  afterEach(() => {
    cleanup();
    useAppStore.setState({ onboardingStep: 0, consentLocalData: false });
  });

  it('visar produktnamnet i sidhuvudet', () => {
    render(<Onboarding />);

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Freevobe');
  });

  it('kan hoppa över Ollama och gå vidare utan modell', () => {
    useAppStore.setState({ onboardingStep: 1, consentLocalData: true });
    render(<Onboarding />);

    expect(screen.getByText(/Ollama svarar inte/)).toBeTruthy();
    expect(screen.getByText(/Du kan hoppa över det här steget/)).toBeTruthy();

    fireEvent.click(screen.getByTestId('onboarding-skip-ollama'));

    expect(useAppStore.getState().onboardingStep).toBe(2);
    expect(screen.getByText('Välj projekt')).toBeTruthy();
  });

  it('frågar om Gives Back i stället för annonser', () => {
    useAppStore.setState({ onboardingStep: 3, consentLocalData: true });
    render(<Onboarding />);

    expect(screen.getByText('Freevobe Gives Back')).toBeTruthy();
    expect(screen.getByText(/tar inte emot pengar/)).toBeTruthy();
    expect(screen.queryByText(/Annonsplats/)).toBeNull();

    fireEvent.click(screen.getAllByRole('checkbox')[0] as HTMLElement);
    expect(useAppStore.getState().consentGivesBack).toBe(true);
  });

  it('erbjuder ingen överhoppning när Ollama redan svarar', () => {
    useAppStore.setState({
      onboardingStep: 1,
      consentLocalData: true,
      ollama: { ...offlineOllama, available: true, error: undefined, version: '0.40.5' },
    });
    render(<Onboarding />);

    expect(screen.queryByTestId('onboarding-skip-ollama')).toBeNull();
    expect(screen.getByText(/Ollama svarar/)).toBeTruthy();
  });
});
