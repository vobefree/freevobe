import { useState } from 'react';
import { useAppStore, type RightTab } from '../../store/appStore';
import { Button, Chip, EmptyState, Tabs } from '../ui';
import { DiffPane } from './DiffPane';
import { TerminalPane } from './TerminalPane';
import { ApprovalPane } from './ApprovalPane';
import { clockTime } from '../../lib/format';

function LogsPane() {
  const logs = useAppStore((state) => state.logs);
  return (
    <div className="h-full overflow-y-auto p-2 font-mono text-[11px]">
      {logs.length === 0 ? (
        <EmptyState
          title="Ingen aktivitet loggad"
          hint="Varje verktygsanrop, godkännande och hook hamnar här."
        />
      ) : (
        logs
          .slice()
          .reverse()
          .map((entry) => (
            <div key={entry.id} className="flex gap-2 py-0.5">
              <span className="shrink-0 text-slate-600">{clockTime(entry.at)}</span>
              <span
                className={
                  entry.level === 'error'
                    ? 'text-alert'
                    : entry.level === 'warn'
                      ? 'text-spark'
                      : 'text-slate-400'
                }
              >
                {entry.text}
              </span>
            </div>
          ))
      )}
    </div>
  );
}

function TestsPane() {
  const testResult = useAppStore((state) => state.testResult);
  const runTests = useAppStore((state) => state.runTests);
  const isRunning = useAppStore((state) => state.isRunning);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-steel p-2">
        <Button variant="primary" disabled={isRunning} onClick={() => void runTests()}>
          Kör tester via agenten
        </Button>
        {testResult ? (
          <span className="text-[11px]">
            <span className="text-mint">{testResult.passed} gröna</span>
            {' · '}
            <span className={testResult.failed > 0 ? 'text-alert' : 'text-slate-500'}>
              {testResult.failed} röda
            </span>
          </span>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-auto bg-anvil p-2">
        {testResult ? (
          <>
            <p className="mb-1 font-mono text-[11px] text-sky">{testResult.command}</p>
            <pre className="font-mono text-[11px] whitespace-pre-wrap text-slate-300">
              {testResult.output}
            </pre>
          </>
        ) : (
          <EmptyState
            title="Inga testresultat än"
            hint="Be agenten köra testerna – den läser felutdatan, föreslår en fix och visar diffen först."
          />
        )}
      </div>
    </div>
  );
}

function McpPane() {
  const mcpServers = useAppStore((state) => state.mcpServers);
  const mcpStatuses = useAppStore((state) => state.mcpStatuses);
  const connectMcp = useAppStore((state) => state.connectMcp);
  const disconnectMcp = useAppStore((state) => state.disconnectMcp);
  const setMcpOpen = useAppStore((state) => state.setMcpOpen);
  const [busy, setBusy] = useState<string | null>(null);

  if (mcpServers.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
        <p className="text-sm text-slate-400">Inga MCP-servrar konfigurerade</p>
        <Button variant="primary" onClick={() => setMcpOpen(true)}>
          Lägg till MCP-server
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2 p-2">
      {mcpServers.map((server) => {
        const status = mcpStatuses.find((entry) => entry.id === server.id);
        return (
          <article key={server.id} className="vf-panel p-2">
            <header className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-200">{server.name}</span>
              <Chip tone={status?.connected ? 'mint' : 'neutral'}>
                {status?.connected ? 'ansluten' : 'från'}
              </Chip>
              <Chip>{server.transport}</Chip>
              {server.requireApproval ? <Chip tone="ember">kräver godkännande</Chip> : null}
            </header>
            <p className="mt-1 font-mono text-[10.5px] text-slate-500">
              {server.transport === 'stdio'
                ? `${server.command ?? ''} ${(server.args ?? []).join(' ')}`
                : server.url}
            </p>
            {status?.connected ? (
              <p className="mt-0.5 text-[10.5px] text-slate-600">
                {status.toolCount} verktyg · {status.resourceCount} resurser · {status.promptCount}{' '}
                prompts
                {status.serverName ? ` · ${status.serverName} ${status.serverVersion ?? ''}` : ''}
              </p>
            ) : null}
            {status?.error ? <p className="mt-1 text-[10.5px] text-alert">{status.error}</p> : null}
            {server.warnings.length > 0 ? (
              <ul className="mt-1 space-y-0.5">
                {server.warnings.map((warning) => (
                  <li key={warning} className="text-[10.5px] text-spark">
                    ⚠ {warning}
                  </li>
                ))}
              </ul>
            ) : null}
            <footer className="mt-2 flex gap-1.5">
              {status?.connected ? (
                <Button
                  variant="danger"
                  disabled={busy === server.id}
                  onClick={async () => {
                    setBusy(server.id);
                    await disconnectMcp(server.id);
                    setBusy(null);
                  }}
                >
                  Koppla från
                </Button>
              ) : (
                <Button
                  variant="primary"
                  disabled={busy === server.id}
                  onClick={async () => {
                    setBusy(server.id);
                    await connectMcp(server.id);
                    setBusy(null);
                  }}
                >
                  Anslut
                </Button>
              )}
              <Button onClick={() => setMcpOpen(true)}>Hantera</Button>
            </footer>
          </article>
        );
      })}
    </div>
  );
}

export function RightPanel() {
  const rightTab = useAppStore((state) => state.rightTab);
  const setRightTab = useAppStore((state) => state.setRightTab);
  const approvals = useAppStore((state) => state.approvals);
  const diffs = useAppStore((state) => state.diffs);
  const mcpServers = useAppStore((state) => state.mcpServers);
  const testResult = useAppStore((state) => state.testResult);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center border-b border-steel px-2">
        <Tabs<RightTab>
          tabs={[
            { id: 'diff', label: 'Diff', badge: diffs.length },
            { id: 'terminal', label: 'Terminal' },
            { id: 'logs', label: 'Loggar' },
            { id: 'tests', label: 'Tester', badge: testResult?.failed ?? 0 },
            { id: 'approvals', label: 'Godkänn', badge: approvals.length },
            { id: 'mcp', label: 'MCP', badge: mcpServers.length },
          ]}
          active={rightTab}
          onChange={setRightTab}
        />
      </header>
      <div className="min-h-0 flex-1">
        {rightTab === 'diff' ? <DiffPane /> : null}
        {rightTab === 'terminal' ? <TerminalPane /> : null}
        {rightTab === 'logs' ? <LogsPane /> : null}
        {rightTab === 'tests' ? <TestsPane /> : null}
        {rightTab === 'approvals' ? <ApprovalPane /> : null}
        {rightTab === 'mcp' ? <McpPane /> : null}
      </div>
    </div>
  );
}
