// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import i18n from '../../i18n';
import { ProviderNotice } from './ProviderNotice';
import { useAppStore } from '../../store/appStore';

const setProviderEnabled = vi.fn(async () => undefined);
const dismissProviderNotice = vi.fn(() => undefined);

beforeEach(async () => {
  await i18n.changeLanguage('en');
  useAppStore.setState({
    providerNotice: { outputType: 'image', providers: ['google', 'xai'], reason: 'local_only' },
    setProviderEnabled,
    dismissProviderNotice,
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ProviderNotice', () => {
  it('förklarar lokal-only-läget och erbjuder båda providers', () => {
    render(<ProviderNotice />);
    expect(screen.getByTestId('provider-notice').textContent).toContain('cloud provider');
    expect(screen.getByTestId('provider-required-google').textContent).toContain('Gemini');
    expect(screen.getByTestId('provider-required-xai').textContent).toContain('Grok');
  });

  it('slår på vald provider', () => {
    render(<ProviderNotice />);
    fireEvent.click(screen.getByTestId('provider-required-google'));
    expect(setProviderEnabled).toHaveBeenCalledWith('google', true);
  });

  it('säger att nyckeln saknas när providern är på men inte redo', () => {
    useAppStore.setState({
      providerNotice: { outputType: 'video', providers: ['google'], reason: 'not_configured' },
    });
    render(<ProviderNotice />);
    expect(screen.getByTestId('provider-notice').textContent).toContain('API key');
  });

  it('går att stänga', () => {
    render(<ProviderNotice />);
    fireEvent.click(screen.getByTestId('provider-notice-dismiss'));
    expect(dismissProviderNotice).toHaveBeenCalled();
  });

  it('renderar inget när ingen provider krävs', () => {
    useAppStore.setState({ providerNotice: null });
    render(<ProviderNotice />);
    expect(screen.queryByTestId('provider-notice')).toBeNull();
  });
});
