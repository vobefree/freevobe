// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ConnectorDefinition, ConnectorView } from '@freevobe/protocol';
import { ConnectorsSection } from './ConnectorsSection';
import { useAppStore } from '../store/appStore';

function definition(overrides: Partial<ConnectorDefinition> & { id: ConnectorDefinition['id'] }) {
  return {
    icon: 'XX',
    authType: 'token' as const,
    availability: 'available' as const,
    builtin: false,
    acceptsToken: true,
    scopes: [
      { id: 'projects:read', required: true },
      { id: 'deployments:write', required: true },
    ],
    tools: [
      {
        id: `${overrides.id}_list`,
        destructive: false,
        requiresApproval: false,
        implemented: false,
      },
      {
        id: `${overrides.id}_deploy`,
        destructive: false,
        requiresApproval: true,
        implemented: false,
      },
    ],
    ...overrides,
  };
}

function view(
  definitionOverrides: Partial<ConnectorDefinition> & { id: ConnectorDefinition['id'] },
  state: Partial<ConnectorView['state']> = {},
): ConnectorView {
  const def = definition(definitionOverrides);
  return {
    definition: def,
    state: {
      connectorId: def.id,
      status: 'disconnected',
      enabled: true,
      updatedAt: 0,
      ...state,
    },
  };
}

const connectors: ConnectorView[] = [
  view(
    { id: 'git', authType: 'local', builtin: true, acceptsToken: false, scopes: [], tools: [] },
    { status: 'connected' },
  ),
  view({ id: 'github', authType: 'oauth', icon: 'GH' }),
  view({ id: 'vercel', icon: 'VE' }),
  view(
    { id: 'netlify', availability: 'coming-soon', acceptsToken: false, icon: 'NE' },
    { status: 'disconnected' },
  ),
];

const baseState = {
  project: {
    id: 'p1',
    path: '/tmp/p1',
    name: 'Demo',
    permissionMode: 'ask' as const,
    createdAt: 0,
    lastOpenedAt: 0,
  },
  connectors,
  connectorStorage: {
    backend: 'encrypted-file' as const,
    cipher: 'aes-256-gcm' as const,
    path: '/home/u/.freevobe/connectors.vault.json',
    keychain: false,
    restrictedPermissions: true,
  },
  connectorBusy: null,
  connectorMessage: null,
};

let connectConnector: ReturnType<typeof vi.fn>;
let disconnectConnector: ReturnType<typeof vi.fn>;
let setConnectorEnabled: ReturnType<typeof vi.fn>;
let refreshConnectors: ReturnType<typeof vi.fn>;

beforeEach(() => {
  connectConnector = vi.fn().mockResolvedValue(undefined);
  disconnectConnector = vi.fn().mockResolvedValue(['projects:read', 'deployments:write']);
  setConnectorEnabled = vi.fn().mockResolvedValue(undefined);
  refreshConnectors = vi.fn().mockResolvedValue(undefined);
  useAppStore.setState({
    ...baseState,
    connectConnector,
    disconnectConnector,
    setConnectorEnabled,
    refreshConnectors,
    setMcpOpen: vi.fn(),
  } as never);
});

afterEach(() => {
  cleanup();
  useAppStore.setState({ connectors: [], connectorStorage: null, connectorMessage: null });
});

describe('ConnectorsSection', () => {
  it('visar ett kort per connector med status och lagringsinformation', () => {
    render(<ConnectorsSection />);
    expect(screen.getByTestId('connector-card-git')).toBeTruthy();
    expect(screen.getByTestId('connector-card-github')).toBeTruthy();
    expect(screen.getByTestId('connector-card-netlify')).toBeTruthy();
    expect(screen.getByTestId('connector-card-git').getAttribute('data-status')).toBe('connected');
    expect(screen.getByText(/aes-256-gcm/)).toBeTruthy();
    expect(screen.getByText(/connectors\.vault\.json/)).toBeTruthy();
    expect(refreshConnectors).toHaveBeenCalled();
  });

  it('visar exakta behörigheter innan något ansluts', () => {
    render(<ConnectorsSection />);
    fireEvent.click(screen.getByTestId('connector-scopes-vercel'));
    const list = screen.getByTestId('connector-scope-list-vercel');
    expect(list.textContent).toContain('projects.read');
    expect(list.textContent).toContain('deployments.write');
    expect(list.textContent).toContain('obligatorisk');
  });

  it('ansluter med token och skickar aldrig med något annat än det användaren skrev', async () => {
    render(<ConnectorsSection />);
    fireEvent.click(screen.getByTestId('connector-connect-vercel'));
    fireEvent.change(screen.getByTestId('connector-token-vercel'), {
      target: { value: ' vercel_token_1234567890 ' },
    });
    fireEvent.change(screen.getByTestId('connector-account-vercel'), {
      target: { value: 'mitt-team' },
    });
    fireEvent.click(screen.getByTestId('connector-save-vercel'));

    await waitFor(() =>
      expect(connectConnector).toHaveBeenCalledWith(
        'vercel',
        'vercel_token_1234567890',
        'mitt-team',
      ),
    );
  });

  it('kräver en bekräftelse innan frånkoppling och visar vad som återkallas', async () => {
    useAppStore.setState({
      connectors: [
        view({ id: 'github', icon: 'GH' }, { status: 'connected', secretHint: 'ghp_ab…1234' }),
      ],
    } as never);
    render(<ConnectorsSection />);

    fireEvent.click(screen.getByTestId('connector-disconnect-github'));
    expect(disconnectConnector).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('connector-confirm-disconnect-github'));
    await waitFor(() => expect(disconnectConnector).toHaveBeenCalledWith('github'));

    const revoked = await screen.findByTestId('connectors-revoked');
    expect(revoked.textContent).toContain('projects:read');
    expect(revoked.textContent).toContain('deployments:write');
  });

  it('slår av och på connectorn per projekt', () => {
    useAppStore.setState({
      connectors: [
        view({ id: 'vercel', icon: 'VE' }, { status: 'connected', secretHint: 'ver…7890' }),
      ],
    } as never);
    render(<ConnectorsSection />);
    fireEvent.click(screen.getByLabelText('Aktiv i projektet'));
    expect(setConnectorEnabled).toHaveBeenCalledWith('vercel', false);
  });

  it('visar kommer snart-connectors utan anslutningsknapp', () => {
    render(<ConnectorsSection />);
    expect(screen.queryByTestId('connector-connect-netlify')).toBeNull();
    expect(screen.getByTestId('connector-card-netlify').textContent).toContain('kommer snart');
  });

  it('förklarar när inget projekt är öppet', () => {
    useAppStore.setState({ project: null } as never);
    render(<ConnectorsSection />);
    expect(screen.getByText('Öppna ett projekt för att hantera connectors')).toBeTruthy();
  });
});
