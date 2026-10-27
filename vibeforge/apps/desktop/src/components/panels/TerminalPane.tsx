import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { Button, EmptyState } from '../ui';

/**
 * Terminalpanelen visar allt som agenten kör – inget döljs. Kommandon startas av agenten
 * (eller av dig via en prompt), och varje kommando kräver godkännande enligt behörighetsläget.
 */
export function TerminalPane() {
  const terminal = useAppStore((state) => state.terminal);
  const clearTerminal = useAppStore((state) => state.clearTerminal);
  const sendPrompt = useAppStore((state) => state.sendPrompt);
  const isRunning = useAppStore((state) => state.isRunning);
  const [command, setCommand] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [terminal.length]);

  const submit = () => {
    const value = command.trim();
    if (!value || isRunning) return;
    setCommand('');
    void sendPrompt(`Kör kommandot \`${value}\` i projektroten och visa resultatet.`);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-steel px-2.5 py-1.5">
        <span className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
          Terminal
        </span>
        <span className="text-[10px] text-slate-600">{terminal.length} rader</span>
        <Button
          className="ml-auto"
          onClick={clearTerminal}
          title="Rensa panelen (loggen finns kvar i agent-loggen)"
        >
          Rensa
        </Button>
      </div>

      <div
        data-testid="terminal-output"
        className="min-h-0 flex-1 overflow-auto bg-anvil px-2 py-1.5 font-mono text-[11.5px] leading-5"
      >
        {terminal.length === 0 ? (
          <EmptyState
            title="Ingen terminalaktivitet"
            hint="Kommandon som agenten kör hamnar här, med utdata och exitkod."
          />
        ) : (
          terminal.map((line) => (
            <div
              key={line.id}
              className={
                line.stream === 'stderr'
                  ? 'text-alert/90'
                  : line.stream === 'system'
                    ? 'text-sky'
                    : 'text-slate-300'
              }
            >
              <span className="mr-2 text-slate-600 select-none">
                {line.stream === 'stderr' ? '!' : line.stream === 'system' ? '›' : '$'}
              </span>
              <span className="whitespace-pre-wrap">{line.text}</span>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>

      <div className="flex shrink-0 items-center gap-2 border-t border-steel p-2">
        <input
          value={command}
          onChange={(event) => setCommand(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') submit();
          }}
          placeholder="t.ex. npm test"
          className="flex-1 rounded border border-steel bg-anvil px-2 py-1 font-mono text-xs text-slate-200 placeholder:text-slate-600"
        />
        <Button variant="primary" onClick={submit} disabled={isRunning || command.trim() === ''}>
          Kör via agenten
        </Button>
      </div>
      <p className="shrink-0 px-2.5 pb-2 text-[10px] text-slate-600">
        Kommandon körs i projektroten och kräver godkännande om inte behörighetsläget tillåter
        annat. Farliga kommandon blockeras alltid.
      </p>
    </div>
  );
}
