import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/appStore';
import { Button } from './ui';

/**
 * Sidchatt: en egen session vid sidan av huvudtråden. Den rör inte huvudchatten, och stängs utan
 * att något av det andra försvinner. Frågor som kräver godkännande hamnar i huvudflödet.
 */
export function SideChatPane() {
  const { t } = useTranslation();
  const open = useAppStore((state) => state.sideChatOpen);
  const messages = useAppStore((state) => state.sideChatMessages);
  const streaming = useAppStore((state) => state.sideChatStreaming);
  const busy = useAppStore((state) => state.sideChatBusy);
  const close = useAppStore((state) => state.closeSideChat);
  const send = useAppStore((state) => state.sendSideChat);
  const [prompt, setPrompt] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length, streaming]);

  if (!open) return null;

  const submit = () => {
    if (!prompt.trim() || busy) return;
    const value = prompt.trim();
    setPrompt('');
    void send(value);
  };

  return (
    <aside
      data-testid="side-chat"
      className="absolute top-0 right-0 bottom-0 z-30 flex w-[22rem] max-w-full flex-col border-l border-steel bg-forge shadow-2xl"
    >
      <header className="flex items-center gap-2 border-b border-steel px-3 py-2">
        <span className="text-xs font-semibold text-slate-200">{t('sideChat.title')}</span>
        <span className="ml-auto text-[10px] text-slate-600">{t('sideChat.hint')}</span>
        <Button onClick={close} title={t('sideChat.close')}>
          ✕
        </Button>
      </header>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {messages.length === 0 && !streaming ? (
          <p className="mt-6 text-center text-xs text-slate-500">{t('sideChat.empty')}</p>
        ) : null}
        {messages.map((message) => (
          <article
            key={message.id}
            className={`rounded-lg px-2.5 py-2 text-xs leading-relaxed whitespace-pre-wrap ${
              message.role === 'user'
                ? 'ml-4 border border-steel bg-steel/30 text-slate-200'
                : 'mr-1 text-slate-300'
            }`}
          >
            {message.content}
          </article>
        ))}
        {streaming ? (
          <article className="mr-1 rounded-lg px-2.5 py-2 text-xs whitespace-pre-wrap text-slate-300">
            {streaming}
          </article>
        ) : null}
        <div ref={bottomRef} />
      </div>

      <footer className="border-t border-steel p-2">
        <textarea
          data-testid="side-chat-composer"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
              event.preventDefault();
              submit();
            }
          }}
          rows={2}
          placeholder={t('sideChat.placeholder')}
          className="w-full resize-none rounded border border-steel bg-anvil px-2 py-1.5 text-xs text-slate-100 placeholder:text-slate-600"
        />
        <div className="mt-1.5 flex justify-end">
          <Button variant="primary" disabled={busy || !prompt.trim()} onClick={submit}>
            {t('sideChat.send')}
          </Button>
        </div>
      </footer>
    </aside>
  );
}
