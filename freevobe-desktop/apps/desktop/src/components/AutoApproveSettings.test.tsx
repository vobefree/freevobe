// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AUTO_APPROVE_CATEGORIES, DEFAULT_AUTO_APPROVE } from '@freevobe/protocol';
import { AutoApproveChips, AutoApproveSettings } from './AutoApproveSettings';

afterEach(() => {
  cleanup();
});

describe('AutoApproveSettings', () => {
  it('visar en ruta per kategori med beskrivning', () => {
    render(<AutoApproveSettings autoApprove={DEFAULT_AUTO_APPROVE} onToggle={() => undefined} />);

    expect(screen.getByTestId('auto-approve-settings')).toBeTruthy();
    expect(screen.getByText('Inget auto-godkänns')).toBeTruthy();
    for (const category of AUTO_APPROVE_CATEGORIES) {
      expect(screen.getByTestId(`auto-approve-${category}`)).toBeTruthy();
    }
    // Webbläsare och övrigt går inte att slå på, så de har ingen ruta.
    expect(screen.queryByTestId('auto-approve-browser')).toBeNull();
    expect(screen.getByText(/Farliga kommandon/)).toBeTruthy();
  });

  it('rapporterar kategori och nytt läge när användaren kryssar', () => {
    const calls: string[] = [];
    render(
      <AutoApproveSettings
        autoApprove={{ ...DEFAULT_AUTO_APPROVE, file_write: true }}
        onToggle={(category, enabled) => calls.push(`${category}:${enabled}`)}
      />,
    );

    const write = screen.getByTestId('auto-approve-file_write') as HTMLInputElement;
    expect(write.checked).toBe(true);
    expect(screen.getByText('1 av 6 kategorier')).toBeTruthy();

    fireEvent.click(write);
    fireEvent.click(screen.getByTestId('auto-approve-test'));

    expect(calls).toEqual(['file_write:false', 'test:true']);
  });
});

describe('AutoApproveChips', () => {
  it('visar inget när inget är på', () => {
    render(<AutoApproveChips autoApprove={DEFAULT_AUTO_APPROVE} />);
    expect(screen.queryByTestId('auto-approve-chips')).toBeNull();
  });

  it('visar bara de kategorier som är påslagna', () => {
    render(
      <AutoApproveChips autoApprove={{ ...DEFAULT_AUTO_APPROVE, file_write: true, test: true }} />,
    );

    expect(screen.getByTestId('auto-approve-chips').textContent).toContain('Filändringar');
    expect(screen.getByTestId('auto-approve-chips').textContent).toContain('Tester');
    expect(screen.getByTestId('auto-approve-chips').textContent).not.toContain('Kommandon');
  });
});
