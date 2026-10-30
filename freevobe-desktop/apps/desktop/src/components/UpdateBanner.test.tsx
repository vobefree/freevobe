// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

const checkForUpdate = vi.fn();
const installUpdate = vi.fn();
const canUpdate = vi.fn(() => true);

vi.mock('../lib/updater', () => ({
  canUpdate: () => canUpdate(),
  checkForUpdate: () => checkForUpdate(),
  installUpdate: () => installUpdate(),
}));

import { UpdateBanner } from './UpdateBanner';

beforeEach(() => {
  vi.useFakeTimers();
  checkForUpdate.mockResolvedValue(null);
  installUpdate.mockResolvedValue(undefined);
  canUpdate.mockReturnValue(true);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

/** Kontrollen väntar några sekunder efter start – klockan måste flyttas fram för att den ska köra. */
async function advanceCheck() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(4000);
  });
}

describe('UpdateBanner', () => {
  it('syns inte när appen redan är senaste version', async () => {
    render(<UpdateBanner />);
    await advanceCheck();

    expect(checkForUpdate).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('update-banner')).toBeNull();
  });

  it('erbjuder den nya versionen och kör installationen', async () => {
    checkForUpdate.mockResolvedValue({ version: '0.3.0', currentVersion: '0.2.5' });
    render(<UpdateBanner />);
    await advanceCheck();

    expect(screen.getByTestId('update-banner').textContent).toContain('0.3.0');
    expect(screen.getByTestId('update-banner').textContent).toContain('0.2.5');

    await act(async () => {
      fireEvent.click(screen.getByText('Uppdatera och starta om'));
    });
    expect(installUpdate).toHaveBeenCalledTimes(1);
  });

  it('går att skjuta upp till nästa start', async () => {
    checkForUpdate.mockResolvedValue({ version: '0.3.0', currentVersion: '0.2.5' });
    render(<UpdateBanner />);
    await advanceCheck();

    fireEvent.click(screen.getByText('Senare'));
    expect(screen.queryByTestId('update-banner')).toBeNull();
  });

  it('visar att uppdateringen misslyckades i stället för att försvinna', async () => {
    checkForUpdate.mockResolvedValue({ version: '0.3.0', currentVersion: '0.2.5' });
    installUpdate.mockRejectedValue(new Error('nätverket svarade inte'));
    render(<UpdateBanner />);
    await advanceCheck();

    await act(async () => {
      fireEvent.click(screen.getByText('Uppdatera och starta om'));
    });

    expect(screen.getByTestId('update-banner').textContent).toContain(
      'Uppdateringen kunde inte installeras.',
    );
  });

  it('frågar inte alls när uppdateraren saknas', async () => {
    canUpdate.mockReturnValue(false);
    render(<UpdateBanner />);
    await advanceCheck();

    expect(checkForUpdate).not.toHaveBeenCalled();
    expect(screen.queryByTestId('update-banner')).toBeNull();
  });
});
