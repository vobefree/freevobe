import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FREEVOBE_MEMORY_FILE, FREEVOBE_RULES_FILE, AGENTS_FILE } from '@freevobe/protocol';
import { useAppStore } from '../store/appStore';
import { Button, Field, Modal } from './ui';

export function MemoryDialog() {
  const { t } = useTranslation();
  const open = useAppStore((state) => state.memoryOpen);
  const setOpen = useAppStore((state) => state.setMemoryOpen);
  const memory = useAppStore((state) => state.memory);
  const refreshMemory = useAppStore((state) => state.refreshMemory);
  const saveMemory = useAppStore((state) => state.saveMemory);
  const [draft, setDraft] = useState(memory);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (open) void refreshMemory();
  }, [open, refreshMemory]);

  // Fyll utkastet med den sparade texten när minnet läses in.
  useEffect(() => setDraft(memory), [memory]);

  if (!open) return null;

  return (
    <Modal
      title={t('memory.title')}
      onClose={() => setOpen(false)}
      width="max-w-3xl"
      footer={
        <>
          <Button onClick={() => setDraft(memory)}>{t('memory.reset')}</Button>
          <Button
            variant="primary"
            onClick={() =>
              void saveMemory(draft).then(() =>
                setStatus(t('memory.saved', { file: FREEVOBE_MEMORY_FILE })),
              )
            }
          >
            {t('memory.save')}
          </Button>
        </>
      }
    >
      <p className="mb-3 text-xs text-slate-500">
        {t('memory.intro.before')} <code className="font-mono">{FREEVOBE_MEMORY_FILE}</code>{' '}
        {t('memory.intro.mid')} <code className="font-mono">{AGENTS_FILE}</code>{' '}
        {t('memory.intro.and')} <code className="font-mono">{FREEVOBE_RULES_FILE}</code>
        {t('memory.intro.after')}
      </p>
      <Field label={t('memory.label')} hint={t('memory.hint')}>
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={18}
          spellCheck={false}
          className="w-full rounded border border-steel bg-anvil p-2 font-mono text-[12px] text-slate-200"
        />
      </Field>
      {status ? <p className="mt-2 text-[11px] text-mint">{status}</p> : null}
    </Modal>
  );
}
