import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChatMessage } from '@freevobe/protocol';
import { useAppStore } from '../../store/appStore';
import { Button, Chip, EmptyState } from '../ui';
import { GivesBackCard } from '../gives-back/GivesBackCard';
import { PlanCard } from './PlanCard';
import { PHASE_LABELS, clockTime } from '../../lib/format';

function MessageBubble({ message }: { message: ChatMessage }) {
  const [showReasoning, setShowReasoning] = useState(false);
  const isUser = message.role === 'user';
  const isTool = message.role === 'tool';

  if (isTool) {
    return (
      <details className="rounded border border-steel/60 bg-forge/40 px-3 py-1.5 text-xs text-slate-500">
        <summary className="cursor-pointer select-none">
          Verktygssvar · {message.content.slice(0, 80)}…
        </summary>
        <pre className="mt-1.5 overflow-x-auto whitespace-pre-wrap font-mono text-[11px] text-slate-400">
          {message.content}
        </pre>
      </details>
    );
  }

  return (
    <article
      data-testid={isUser ? 'message-user' : 'message-assistant'}
      className={`rounded-lg px-3.5 py-2.5 ${isUser ? 'ml-6 border border-steel bg-steel/30' : 'mr-2'}`}
    >
      <header className="mb-1 flex items-center gap-2">
        <span
          className={`text-[11px] font-semibold tracking-wide uppercase ${isUser ? 'text-sky' : 'text-ember'}`}
        >
          {isUser ? 'Du' : 'Freevobe'}
        </span>
        <span className="text-[10px] text-slate-600">{clockTime(message.createdAt)}</span>
        {message.model && !isUser ? <Chip>{message.model}</Chip> : null}
        {message.reasoning ? (
          <button
            type="button"
            className="cursor-pointer text-[10px] text-slate-500 underline decoration-dotted"
            onClick={() => setShowReasoning((value) => !value)}
          >
            {showReasoning ? 'dölj tankegång' : 'visa tankegång'}
          </button>
        ) : null}
      </header>
      <div className="text-sm leading-relaxed whitespace-pre-wrap text-slate-200">
        {message.content}
      </div>
      {showReasoning && message.reasoning ? (
        <pre className="mt-2 max-h-48 overflow-auto rounded border border-steel/60 bg-anvil/60 p-2 font-mono text-[11px] whitespace-pre-wrap text-slate-500">
          {message.reasoning}
        </pre>
      ) : null}
    </article>
  );
}

export function ChatView() {
  const messages = useAppStore((state) => state.messages);
  const streamingText = useAppStore((state) => state.streamingText);
  const reasoningText = useAppStore((state) => state.reasoningText);
  const isRunning = useAppStore((state) => state.isRunning);
  const phase = useAppStore((state) => state.phase);
  const givesBack = useAppStore((state) => state.settings?.givesBack ?? null);
  const sessionId = useAppStore((state) => state.sessionId);
  const plans = useAppStore((state) => state.plans);
  const draft = useState(() => ({ value: '' }))[0];

  // Den senaste planen är den som gäller: antingen väntar den på beslut eller så är den
  // kontraktet som styr körningen.
  const currentPlan = plans.find(
    (plan) => plan.status === 'proposed' || plan.status === 'approved',
  );

  const [prompt, setPrompt] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const promptCount = useMemo(
    () => messages.filter((message) => message.role === 'user').length,
    [messages],
  );
  const givesBackInterval = Math.max(1, givesBack?.everyNPrompts ?? 10);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, streamingText]);

  const submit = () => {
    const value = textareaRef.current?.value ?? prompt;
    if (!value.trim() || isRunning) return;
    setPrompt('');
    draft.value = '';
    if (textareaRef.current) textareaRef.current.value = '';
    void useAppStore.getState().sendPrompt(value.trim());
  };

  if (!sessionId) {
    return (
      <EmptyState
        title="Ingen chatt vald"
        hint="Skapa en ny chatt i vänsterpanelen för att börja smida."
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && !streamingText ? (
          <div className="mx-auto mt-8 max-w-xl space-y-3 text-center">
            <h2 className="text-lg font-semibold text-slate-200">Vad ska vi smida idag?</h2>
            <p className="text-xs text-slate-500">
              Beskriv uppgiften på vanlig svenska. Freevobe läser koden, föreslår ändringar som
              diffar och kör tester – allt lokalt på din dator.
            </p>
            <div className="flex flex-wrap justify-center gap-2 pt-2">
              {[
                'Förklara hur agent-loopen fungerar i det här projektet',
                'Lägg till ett test för diff-motorn',
                'Granska mina senaste ändringar och hitta risker',
              ].map((example) => (
                <button
                  key={example}
                  type="button"
                  className="vf-button cursor-pointer text-left"
                  onClick={() => {
                    setPrompt(example);
                    if (textareaRef.current) textareaRef.current.value = example;
                  }}
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {messages.map((message, index) => {
          const usersSoFar = messages
            .slice(0, index + 1)
            .filter((entry) => entry.role === 'user').length;
          return (
            <div key={message.id}>
              <MessageBubble message={message} />
              {message.role === 'assistant' ? <GivesBackCard promptIndex={usersSoFar} /> : null}
            </div>
          );
        })}

        {/* Planen ligger sist i flödet: då syns den när den läggs fram, utan att scrolla upp. */}
        {currentPlan ? <PlanCard plan={currentPlan} /> : null}

        {streamingText ? (
          <article className="mr-2 rounded-lg px-3.5 py-2.5">
            <header className="mb-1 flex items-center gap-2">
              <span className="text-[11px] font-semibold tracking-wide text-ember uppercase">
                Freevobe
              </span>
              <span className="text-[10px] text-slate-500">
                {PHASE_LABELS[phase as keyof typeof PHASE_LABELS] ?? phase}
              </span>
              <span className="h-2 w-2 animate-pulse rounded-full bg-ember" />
            </header>
            <div className="text-sm leading-relaxed whitespace-pre-wrap text-slate-200">
              {streamingText}
            </div>
            {reasoningText ? (
              <details className="mt-2 text-[11px] text-slate-500">
                <summary className="cursor-pointer">
                  Tankegång ({reasoningText.length} tecken)
                </summary>
                <pre className="mt-1 max-h-40 overflow-auto font-mono whitespace-pre-wrap">
                  {reasoningText}
                </pre>
              </details>
            ) : null}
          </article>
        ) : null}

        <div ref={bottomRef} />
      </div>

      <footer className="border-t border-steel p-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            data-testid="composer"
            value={prompt}
            onChange={(event) => {
              setPrompt(event.target.value);
              draft.value = event.target.value;
            }}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                event.preventDefault();
                submit();
              }
            }}
            rows={3}
            placeholder="Beskriv vad du vill bygga… (Ctrl/Cmd+Enter skickar)"
            className="min-h-[64px] flex-1 resize-y rounded border border-steel bg-anvil px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600"
          />
          <div className="flex flex-col gap-1.5">
            {isRunning ? (
              <Button
                variant="danger"
                onClick={() => void useAppStore.getState().abort()}
                title="Avbryt körningen"
              >
                Avbryt
              </Button>
            ) : (
              <Button variant="primary" onClick={submit} title="Skicka (Ctrl/Cmd+Enter)">
                Skicka
              </Button>
            )}
            <span className="text-center text-[10px] text-slate-600">{promptCount} prompter</span>
          </div>
        </div>
        <p className="mt-1.5 text-[10px] text-slate-600">
          Gives Back: {givesBack?.enabled ? `var ${givesBackInterval}:e prompt` : 'av'} · inga
          uppgifter lämnar datorn
        </p>
      </footer>
    </div>
  );
}
