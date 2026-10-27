import { useEffect, useState } from 'react';
import { VIBEFORGE_MEMORY_FILE, VIBEFORGE_RULES_FILE, AGENTS_FILE } from '@vibeforge/protocol';
import { useAppStore } from '../store/appStore';
import { Button, Field, Modal } from './ui';

export function MemoryDialog() {
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
      title="Projektminne och regler"
      onClose={() => setOpen(false)}
      width="max-w-3xl"
      footer={
        <>
          <Button onClick={() => setDraft(memory)}>Återställ</Button>
          <Button
            variant="primary"
            onClick={() =>
              void saveMemory(draft).then(() => setStatus(`Sparat i ${VIBEFORGE_MEMORY_FILE}.`))
            }
          >
            Spara minne
          </Button>
        </>
      }
    >
      <p className="mb-3 text-xs text-slate-500">
        Minnet är en vanlig Markdown-fil i projektet (
        <code className="font-mono">{VIBEFORGE_MEMORY_FILE}</code>) som injiceras i systemprompten
        tillsammans med <code className="font-mono">{AGENTS_FILE}</code> och{' '}
        <code className="font-mono">{VIBEFORGE_RULES_FILE}</code>. Det är lokal, versionshanterbart
        och redigerbart.
      </p>
      <Field
        label="Projektminne"
        hint="Skriv ner arkitektur, tekniska val, kända buggar, testkommandon och kodstil – det agenten ska komma ihåg."
      >
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
