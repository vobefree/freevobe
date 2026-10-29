import { useState } from 'react';
import type { McpServerConfig } from '@freevobe/protocol';
import { useAppStore } from '../store/appStore';
import { Button, Chip, Field, Modal, Toggle } from './ui';

function blankServer(): McpServerConfig {
  return {
    id: `mcp_${Date.now().toString(36)}`,
    name: 'ny-server',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '.'],
    enabled: true,
    requireApproval: true,
    warnings: [],
  };
}

export function McpDialog() {
  const open = useAppStore((state) => state.mcpOpen);
  const setOpen = useAppStore((state) => state.setMcpOpen);
  const servers = useAppStore((state) => state.mcpServers);
  const examples = useAppStore((state) => state.mcpExamples);
  const statuses = useAppStore((state) => state.mcpStatuses);
  const saveMcpServers = useAppStore((state) => state.saveMcpServers);
  const connectMcp = useAppStore((state) => state.connectMcp);
  const disconnectMcp = useAppStore((state) => state.disconnectMcp);
  const [draft, setDraft] = useState<McpServerConfig | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  if (!open) return null;

  const upsert = (server: McpServerConfig) => {
    setDraft(server);
  };

  const commit = async () => {
    if (!draft) return;
    const exists = servers.some((server) => server.id === draft.id);
    const next = exists
      ? servers.map((server) => (server.id === draft.id ? draft : server))
      : [...servers, draft];
    await saveMcpServers(next);
    setStatus(`Sparade ${draft.name}.`);
    setDraft(null);
  };

  const remove = async (id: string) => {
    await disconnectMcp(id).catch(() => undefined);
    await saveMcpServers(servers.filter((server) => server.id !== id));
    setStatus('Servern togs bort.');
  };

  return (
    <Modal title="MCP-servrar" onClose={() => setOpen(false)} width="max-w-4xl">
      <p className="mb-3 text-xs text-slate-500">
        MCP-verktyg dyker upp som vanliga agentverktyg. Varje server kan aktiveras per projekt, och
        servrar som kräver godkännande visar en varning innan verktygen får köras.
      </p>

      <datalist id="mcp-examples">
        {examples.map((example) => (
          <option key={example.id} value={example.name} />
        ))}
      </datalist>

      <div className="grid grid-cols-2 gap-4">
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
              Konfigurerade
            </h3>
            <span className="text-[10px] text-slate-600">{servers.length} st</span>
            <Button className="ml-auto" onClick={() => upsert(blankServer())}>
              Ny server
            </Button>
          </div>

          <ul className="max-h-72 space-y-1 overflow-y-auto">
            {servers.length === 0 ? (
              <li className="text-[11.5px] text-slate-600">
                Inga servrar än. Lägg till en från exempellistan till höger.
              </li>
            ) : (
              servers.map((server) => {
                const status = statuses.find((entry) => entry.id === server.id);
                return (
                  <li key={server.id} className="rounded border border-steel p-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[12px] font-medium text-slate-200">{server.name}</span>
                      <Chip tone={status?.connected ? 'mint' : 'neutral'}>{server.transport}</Chip>
                      {!server.enabled ? <Chip>avstängd</Chip> : null}
                      {server.requireApproval ? <Chip tone="ember">godkännande</Chip> : null}
                    </div>
                    <p className="mt-0.5 truncate font-mono text-[10.5px] text-slate-500">
                      {server.transport === 'stdio'
                        ? `${server.command ?? ''} ${(server.args ?? []).join(' ')}`
                        : server.url}
                    </p>
                    {status?.error ? (
                      <p className="mt-0.5 text-[10.5px] text-alert">{status.error}</p>
                    ) : null}
                    <div className="mt-1.5 flex gap-1.5">
                      <Button onClick={() => upsert(server)}>Redigera</Button>
                      {status?.connected ? (
                        <Button onClick={() => void disconnectMcp(server.id)}>Koppla från</Button>
                      ) : (
                        <Button variant="primary" onClick={() => void connectMcp(server.id)}>
                          Anslut
                        </Button>
                      )}
                      <Button variant="danger" onClick={() => void remove(server.id)}>
                        Ta bort
                      </Button>
                    </div>
                  </li>
                );
              })
            )}
          </ul>

          <div className="space-y-1 rounded border border-steel p-2">
            <h4 className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase">
              Exempel att lägga till
            </h4>
            {examples.length === 0 ? (
              <p className="text-[11px] text-slate-600">Inga exempel tillgängliga.</p>
            ) : (
              examples.map((example) => (
                <div key={example.id} className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11.5px] text-slate-300">{example.name}</p>
                    <p className="truncate font-mono text-[10px] text-slate-600">
                      {example.transport === 'stdio'
                        ? `${example.command} ${(example.args ?? []).join(' ')}`
                        : example.url}
                    </p>
                  </div>
                  <Button
                    onClick={() =>
                      upsert({ ...example, id: `${example.id}_${Date.now().toString(36)}` })
                    }
                  >
                    Lägg till
                  </Button>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
            {draft ? `Redigera ${draft.name}` : 'Välj en server'}
          </h3>
          {draft ? (
            <>
              <Field label="Namn">
                <input
                  value={draft.name}
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                  className="w-full rounded border border-steel bg-anvil px-2 py-1.5 text-xs text-slate-200"
                />
              </Field>
              <Field label="Transport">
                <select
                  value={draft.transport}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      transport: event.target.value as McpServerConfig['transport'],
                    })
                  }
                  className="w-full rounded border border-steel bg-anvil px-2 py-1.5 text-xs text-slate-200"
                >
                  <option value="stdio">stdio (lokal process)</option>
                  <option value="http">HTTP</option>
                  <option value="sse">SSE</option>
                </select>
              </Field>
              {draft.transport === 'stdio' ? (
                <>
                  <Field label="Kommando">
                    <input
                      value={draft.command ?? ''}
                      onChange={(event) => setDraft({ ...draft, command: event.target.value })}
                      className="w-full rounded border border-steel bg-anvil px-2 py-1.5 font-mono text-xs text-slate-200"
                    />
                  </Field>
                  <Field label="Argument" hint="Kommaseparerade.">
                    <input
                      value={(draft.args ?? []).join(', ')}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          args: event.target.value
                            .split(',')
                            .map((entry) => entry.trim())
                            .filter(Boolean),
                        })
                      }
                      className="w-full rounded border border-steel bg-anvil px-2 py-1.5 font-mono text-xs text-slate-200"
                    />
                  </Field>
                </>
              ) : (
                <Field label="URL">
                  <input
                    value={draft.url ?? ''}
                    onChange={(event) => setDraft({ ...draft, url: event.target.value })}
                    className="w-full rounded border border-steel bg-anvil px-2 py-1.5 font-mono text-xs text-slate-200"
                  />
                </Field>
              )}
              <Field
                label="Miljövariabler"
                hint="Nycklar separeras med komma, t.ex. API_KEY. Värden sätts i din miljö."
              >
                <input
                  defaultValue={Object.keys(draft.env ?? {}).join(', ')}
                  onBlur={(event) =>
                    setDraft({
                      ...draft,
                      env: Object.fromEntries(
                        event.target.value
                          .split(',')
                          .map((key) => key.trim())
                          .filter(Boolean)
                          .map((key) => [key, draft.env?.[key] ?? '']),
                      ),
                    })
                  }
                  className="w-full rounded border border-steel bg-anvil px-2 py-1.5 font-mono text-xs text-slate-200"
                />
              </Field>
              <Toggle
                checked={draft.enabled}
                onChange={(value) => setDraft({ ...draft, enabled: value })}
                label="Aktiv i det här projektet"
              />
              <Toggle
                checked={draft.requireApproval}
                onChange={(value) => setDraft({ ...draft, requireApproval: value })}
                label="Kräv godkännande innan verktyg från servern körs (rekommenderas)"
              />
              {draft.transport === 'stdio' ? (
                <p className="rounded border border-spark/40 bg-spark/10 p-2 text-[11px] text-spark">
                  ⚠ stdio-servrar startar en lokal process med dina rättigheter. Granska kommandot
                  innan du ansluter.
                </p>
              ) : (
                <p className="rounded border border-spark/40 bg-spark/10 p-2 text-[11px] text-spark">
                  ⚠ Nätverksservrar kan skicka projektdata vidare. Aktivera bara servrar du litar
                  på.
                </p>
              )}
              <div className="flex gap-2">
                <Button variant="primary" onClick={() => void commit()}>
                  Spara
                </Button>
                <Button onClick={() => setDraft(null)}>Avbryt</Button>
              </div>
            </>
          ) : (
            <p className="text-[11.5px] text-slate-600">
              Välj en server till vänster för att redigera, eller lägg till en ny.
            </p>
          )}
          {status ? <p className="text-[11px] text-mint">{status}</p> : null}
        </section>
      </div>
    </Modal>
  );
}
