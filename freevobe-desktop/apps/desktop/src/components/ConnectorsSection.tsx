import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ConnectorId, ConnectorView } from '@freevobe/protocol';
import { useAppStore } from '../store/appStore';
import { Button, Chip, EmptyState, Field, Toggle } from './ui';

/**
 * Namn och beskrivningar bor i locale-filerna, inte i serverns katalog: servern skickar bara id:n.
 * Mapparna nedan finns för att nycklarna ska vara statiskt läsbara (i18n-kontrollen och granskning).
 */
const CONNECTOR_NAME_KEYS: Record<ConnectorId, string> = {
  git: 'connectors.git.name',
  github: 'connectors.github.name',
  vercel: 'connectors.vercel.name',
  supabase: 'connectors.supabase.name',
  netlify: 'connectors.netlify.name',
  railway: 'connectors.railway.name',
  stripe: 'connectors.stripe.name',
  resend: 'connectors.resend.name',
  cloudflare: 'connectors.cloudflare.name',
  neon: 'connectors.neon.name',
};

const CONNECTOR_DESCRIPTION_KEYS: Record<ConnectorId, string> = {
  git: 'connectors.git.description',
  github: 'connectors.github.description',
  vercel: 'connectors.vercel.description',
  supabase: 'connectors.supabase.description',
  netlify: 'connectors.netlify.description',
  railway: 'connectors.railway.description',
  stripe: 'connectors.stripe.description',
  resend: 'connectors.resend.description',
  cloudflare: 'connectors.cloudflare.description',
  neon: 'connectors.neon.description',
};

const SCOPE_KEYS: Record<string, string> = {
  'projects:read': 'connectors.scope.projects.read',
  'projects:write': 'connectors.scope.projects.write',
  'deployments:read': 'connectors.scope.deployments.read',
  'deployments:write': 'connectors.scope.deployments.write',
  'env:write': 'connectors.scope.env.write',
  'domains:write': 'connectors.scope.domains.write',
  'domains:read': 'connectors.scope.domains.read',
  'database:read': 'connectors.scope.database.read',
  'database:write': 'connectors.scope.database.write',
  'secrets:rotate': 'connectors.scope.secrets.rotate',
  'repository:read': 'connectors.scope.repository.read',
  'repository:write': 'connectors.scope.repository.write',
  'pull_requests:write': 'connectors.scope.pullRequests.write',
  'issues:write': 'connectors.scope.issues.write',
  'releases:write': 'connectors.scope.releases.write',
  'checks:read': 'connectors.scope.checks.read',
  'sites:write': 'connectors.scope.sites.write',
  'payments:read': 'connectors.scope.payments.read',
  'emails:send': 'connectors.scope.emails.send',
  'zones:read': 'connectors.scope.zones.read',
  'workers:write': 'connectors.scope.workers.write',
};

const STATUS_TONE: Record<ConnectorView['state']['status'], 'mint' | 'neutral' | 'alert'> = {
  connected: 'mint',
  disconnected: 'neutral',
  error: 'alert',
};

const STATUS_KEYS: Record<ConnectorView['state']['status'], string> = {
  connected: 'connectors.status.connected',
  disconnected: 'connectors.status.disconnected',
  error: 'connectors.status.error',
};

const AUTH_KEYS: Record<ConnectorView['definition']['authType'], string> = {
  oauth: 'connectors.auth.oauth',
  token: 'connectors.auth.token',
  api_key: 'connectors.auth.apiKey',
  local: 'connectors.auth.local',
};

function scopeKey(id: string): string {
  return SCOPE_KEYS[id] ?? 'connectors.scope.unknown';
}

function scopeLabel(id: string): string {
  // Behörighets-id:t visas alltid i mono vid sidan av etiketten, så en okänd id är fortfarande läsbar.
  return id.replace(':', '.');
}

/**
 * Connectors i Settings: en grid med kort där varje kort visar exakt vilka behörigheter som
 * begärs innan något ansluts, och vad som återkallas när användaren kopplar bort.
 */
export function ConnectorsSection() {
  const { t } = useTranslation();
  const project = useAppStore((state) => state.project);
  const connectors = useAppStore((state) => state.connectors);
  const storage = useAppStore((state) => state.connectorStorage);
  const busy = useAppStore((state) => state.connectorBusy);
  const message = useAppStore((state) => state.connectorMessage);
  const refreshConnectors = useAppStore((state) => state.refreshConnectors);
  const connectConnector = useAppStore((state) => state.connectConnector);
  const disconnectConnector = useAppStore((state) => state.disconnectConnector);
  const setConnectorEnabled = useAppStore((state) => state.setConnectorEnabled);
  const setMcpOpen = useAppStore((state) => state.setMcpOpen);

  const [openId, setOpenId] = useState<string | null>(null);
  const [secret, setSecret] = useState('');
  const [accountLabel, setAccountLabel] = useState('');
  const [confirming, setConfirming] = useState<string | null>(null);
  const [revoked, setRevoked] = useState<{ id: ConnectorId; scopes: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (project) void refreshConnectors();
  }, [project, refreshConnectors]);

  const resetForm = () => {
    setOpenId(null);
    setSecret('');
    setAccountLabel('');
    setConfirming(null);
  };

  const connect = async (id: string) => {
    setError(null);
    try {
      await connectConnector(id, secret.trim(), accountLabel.trim());
      resetForm();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const disconnect = async (id: ConnectorId) => {
    setError(null);
    try {
      const scopes = await disconnectConnector(id);
      setRevoked({ id, scopes });
      resetForm();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  if (!project) {
    return <EmptyState title={t('connectors.noProject')} hint={t('connectors.noProjectHint')} />;
  }

  return (
    <div className="space-y-2" data-testid="connectors-section">
      <p className="text-[11.5px] text-slate-500">{t('connectors.intro')}</p>

      {storage ? (
        <p className="rounded border border-steel/70 bg-forge/40 p-1.5 font-mono text-[10px] text-slate-600">
          {t('connectors.storage', { cipher: storage.cipher, path: storage.path })}
          <span className="mt-0.5 block font-sans">
            {storage.keychain ? t('connectors.keychainOn') : t('connectors.keychainOff')}
          </span>
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        {connectors.map((view) => {
          const { definition, state } = view;
          const { id } = definition;
          const name = t(CONNECTOR_NAME_KEYS[id]);
          const comingSoon = definition.availability === 'coming-soon';
          const connected = state.status === 'connected';
          const canConnect = !comingSoon && !definition.builtin && !connected;
          const open = openId === id;

          return (
            <article
              key={id}
              data-testid={`connector-card-${id}`}
              data-status={state.status}
              className={`rounded border border-steel bg-forge/40 p-2.5 ${
                comingSoon ? 'opacity-70' : ''
              }`}
            >
              <header className="flex items-start gap-2">
                <span
                  aria-hidden="true"
                  className="grid h-8 w-8 shrink-0 place-items-center rounded border border-steel bg-anvil font-mono text-[11px] text-slate-300"
                >
                  {definition.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <h4 className="text-xs font-semibold text-slate-200">{name}</h4>
                    {comingSoon ? (
                      <Chip tone="ember">{t('connectors.status.comingSoon')}</Chip>
                    ) : definition.builtin ? (
                      <Chip tone="mint">{t('connectors.status.builtin')}</Chip>
                    ) : (
                      <Chip tone={STATUS_TONE[state.status]}>{t(STATUS_KEYS[state.status])}</Chip>
                    )}
                    <Chip>{t(AUTH_KEYS[definition.authType])}</Chip>
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {t(CONNECTOR_DESCRIPTION_KEYS[id])}
                  </p>
                </div>
              </header>

              <p className="mt-1 font-mono text-[10px] text-slate-600">
                {t(
                  definition.tools.every((tool) => tool.implemented)
                    ? 'connectors.tools'
                    : 'connectors.toolsPlanned',
                  { count: definition.tools.length },
                )}
                {state.secretHint ? ` · ${state.secretHint}` : ''}
                {state.accountLabel ? ` · ${state.accountLabel}` : ''}
              </p>

              {connected && definition.tools.some((tool) => tool.requiresApproval) ? (
                <p className="mt-1 text-[10.5px] text-slate-600">{t('connectors.toolsNote')}</p>
              ) : null}

              {definition.builtin ? (
                <p className="mt-1 text-[10.5px] text-slate-600">{t('connectors.builtinNote')}</p>
              ) : null}

              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {comingSoon ? (
                  <span className="text-[10.5px] text-slate-600">
                    {t('connectors.comingSoonHint')}
                  </span>
                ) : (
                  <>
                    {definition.scopes.length > 0 ? (
                      <Button
                        onClick={() => {
                          setError(null);
                          setOpenId(open ? null : id);
                        }}
                        testId={`connector-scopes-${id}`}
                      >
                        {open
                          ? t('connectors.scopes.hide')
                          : t('connectors.scopes.toggle', { count: definition.scopes.length })}
                      </Button>
                    ) : null}

                    {connected ? (
                      confirming === id ? (
                        <>
                          <Button
                            variant="danger"
                            disabled={busy === id}
                            onClick={() => void disconnect(id)}
                            testId={`connector-confirm-disconnect-${id}`}
                          >
                            {t('connectors.disconnectConfirm')}
                          </Button>
                          <Button variant="ghost" onClick={() => setConfirming(null)}>
                            {t('connectors.cancel')}
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="danger"
                          disabled={busy === id}
                          onClick={() => setConfirming(id)}
                          testId={`connector-disconnect-${id}`}
                        >
                          {t('connectors.disconnect')}
                        </Button>
                      )
                    ) : (
                      <Button
                        variant="primary"
                        disabled={comingSoon || busy === id}
                        onClick={() => {
                          setError(null);
                          setOpenId(id);
                        }}
                        testId={`connector-connect-${id}`}
                      >
                        {t('connectors.connect')}
                      </Button>
                    )}

                    {!definition.builtin && (connected || state.secretHint) ? (
                      <Toggle
                        checked={state.enabled}
                        onChange={(value) => void setConnectorEnabled(id, value)}
                        label={t('connectors.enable')}
                      />
                    ) : null}
                  </>
                )}
              </div>

              {open && !comingSoon ? (
                <div className="mt-2 space-y-2 rounded border border-steel/70 bg-anvil/50 p-2">
                  <div>
                    <p className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase">
                      {t('connectors.scopes.title')}
                    </p>
                    <ul className="mt-1 space-y-0.5" data-testid={`connector-scope-list-${id}`}>
                      {definition.scopes.map((scope) => (
                        <li key={scope.id} className="flex items-center gap-1.5 text-[10.5px]">
                          <code className="font-mono text-slate-400">{scopeLabel(scope.id)}</code>
                          <span className="text-slate-500">{t(scopeKey(scope.id))}</span>
                          <Chip tone={scope.required ? 'ember' : 'neutral'}>
                            {scope.required
                              ? t('connectors.scopes.required')
                              : t('connectors.scopes.optional')}
                          </Chip>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {canConnect ? (
                    <>
                      <Field label={t('connectors.tokenLabel')} hint={t('connectors.tokenHint')}>
                        <input
                          type="password"
                          value={secret}
                          autoComplete="off"
                          data-testid={`connector-token-${id}`}
                          onChange={(event) => setSecret(event.target.value)}
                          className="w-full rounded border border-steel bg-anvil px-2 py-1 font-mono text-xs text-slate-200"
                        />
                      </Field>
                      <Field label={t('connectors.accountLabel')}>
                        <input
                          value={accountLabel}
                          placeholder={t('connectors.accountPlaceholder')}
                          data-testid={`connector-account-${id}`}
                          onChange={(event) => setAccountLabel(event.target.value)}
                          className="w-full rounded border border-steel bg-anvil px-2 py-1 text-xs text-slate-200"
                        />
                      </Field>
                      {definition.tokenUrl ? (
                        <a
                          className="text-[10.5px] text-sky hover:underline"
                          href={definition.tokenUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                        >
                          {t('connectors.tokenUrl', { provider: name })}
                        </a>
                      ) : null}
                      <p className="text-[10px] text-slate-600">{t('connectors.connectNote')}</p>
                      <Button
                        variant="primary"
                        disabled={secret.trim() === '' || busy === id}
                        onClick={() => void connect(id)}
                        testId={`connector-save-${id}`}
                      >
                        {t('connectors.connect')}
                      </Button>
                    </>
                  ) : (
                    <p className="text-[10.5px] text-slate-600">{t('connectors.disconnectNote')}</p>
                  )}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      {message ? (
        <p className="text-[11px] text-mint" data-testid="connectors-message">
          {message}
        </p>
      ) : null}

      {revoked ? (
        <p className="text-[10.5px] text-slate-500" data-testid="connectors-revoked">
          {revoked.scopes.length > 0
            ? t('connectors.revoked', {
                name: t(CONNECTOR_NAME_KEYS[revoked.id]),
                scopes: revoked.scopes.join(', '),
              })
            : t('connectors.revokedNone', { name: t(CONNECTOR_NAME_KEYS[revoked.id]) })}
        </p>
      ) : null}

      {error ? (
        <p className="text-[11px] text-alert" data-testid="connectors-error">
          {error}
        </p>
      ) : null}

      <div className="rounded border border-steel/70 p-2">
        <p className="text-[11px] text-slate-300">{t('connectors.openMcp')}</p>
        <p className="mt-0.5 text-[10.5px] text-slate-600">{t('connectors.openMcpHint')}</p>
        <Button className="mt-1" onClick={() => setMcpOpen(true)}>
          {t('connectors.openMcpAction')}
        </Button>
      </div>
    </div>
  );
}
