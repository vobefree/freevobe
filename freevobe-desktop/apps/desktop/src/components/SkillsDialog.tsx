import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FREEVOBE_SKILLS_DIR, type SkillSummary } from '@freevobe/protocol';
import { useAppStore } from '../store/appStore';
import { Button, Chip, Field, Modal } from './ui';

const SOURCE_KEYS: Record<SkillSummary['source'], string> = {
  builtin: 'skills.source.builtin',
  project: 'skills.source.project',
  user: 'skills.source.user',
};

export function SkillsDialog() {
  const { t } = useTranslation();
  const open = useAppStore((state) => state.skillsOpen);
  const setOpen = useAppStore((state) => state.setSkillsOpen);
  const skills = useAppStore((state) => state.skills);
  const refreshSkills = useAppStore((state) => state.refreshSkills);
  const copyBuiltinSkills = useAppStore((state) => state.copyBuiltinSkills);
  const saveSkill = useAppStore((state) => state.saveSkill);
  const deleteSkill = useAppStore((state) => state.deleteSkill);
  const exportSkill = useAppStore((state) => state.exportSkill);
  const importSkills = useAppStore((state) => state.importSkills);

  const [draft, setDraft] = useState({ name: '', description: '', triggers: '', body: '' });
  const [selected, setSelected] = useState<SkillSummary | null>(null);
  const [importText, setImportText] = useState('');
  const [importing, setImporting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  if (!open) return null;

  const copy = async (text: string, message: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setStatus(message);
    } catch {
      setStatus(t('skills.copyFailed'));
    }
  };

  const doImport = () => {
    if (importText.trim()) {
      void copy(importText.trim(), t('skills.copiedImport'));
      setSelected(null);
      setDraft({
        name: importText.match(/name:\s*(.+)/)?.[1]?.trim() ?? 'imported-skill',
        description: importText.match(/description:\s*(.+)/)?.[1]?.trim() ?? '',
        triggers: importText.match(/triggers:\s*\[?(.+?)\]?$/m)?.[1] ?? '',
        body: importText.split('---').slice(2).join('---').trim(),
      });
    }
  };

  const doFileImport = () => {
    setImporting(true);
    void (async () => {
      try {
        const result = await importSkills([importText]);
        setStatus(t('skills.imported', { count: result, dir: FREEVOBE_SKILLS_DIR }));
        setImportText('');
      } catch (error) {
        setStatus(String(error));
      } finally {
        setImporting(false);
      }
    })();
  };

  return (
    <Modal title={t('skills.title')} onClose={() => setOpen(false)} width="max-w-4xl">
      <p className="mb-3 text-xs text-slate-500">
        {t('skills.intro.before')} <code className="font-mono">{FREEVOBE_SKILLS_DIR}</code>
        {t('skills.intro.after')} <code className="font-mono">@skillname</code>
        {t('skills.intro.end')}
      </p>

      <div className="grid grid-cols-2 gap-4">
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
              {t('skills.existing')}
            </h3>
            <span className="text-[10px] text-slate-600">
              {t('skills.count', { count: skills.length })}
            </span>
            <Button className="ml-auto" onClick={() => void refreshSkills()}>
              {t('skills.refresh')}
            </Button>
            <Button onClick={() => void copyBuiltinSkills()} title={t('skills.copyBuiltinTitle')}>
              {t('skills.copyBuiltin')}
            </Button>
          </div>
          <ul className="max-h-72 space-y-1 overflow-y-auto">
            {skills.length === 0 ? (
              <li className="text-[11.5px] text-slate-600">{t('skills.none')}</li>
            ) : (
              skills.map((skill) => (
                <li key={`${skill.source}-${skill.name}`}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(skill);
                      setDraft({
                        name: skill.name,
                        description: skill.description,
                        triggers: skill.triggers.join(', '),
                        body: '',
                      });
                    }}
                    className={`w-full cursor-pointer rounded border p-2 text-left ${
                      selected?.name === skill.name
                        ? 'border-ember/60 bg-steel/30'
                        : 'border-steel hover:bg-steel/20'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-[12px] font-medium text-slate-200">{skill.name}</span>
                      <Chip tone={skill.source === 'builtin' ? 'neutral' : 'ember'}>
                        {t(SOURCE_KEYS[skill.source])}
                      </Chip>
                      <span className="ml-auto text-[10px] text-slate-600">
                        {t('skills.tokens', { count: skill.chars })}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-500">{skill.description}</p>
                    <p className="mt-0.5 truncate font-mono text-[10px] text-slate-600">
                      {t('skills.meta', {
                        triggers: skill.triggers.join(', ') || '–',
                        tools: skill.tools.join(', ') || '–',
                      })}
                    </p>
                  </button>
                </li>
              ))
            )}
          </ul>

          <div className="space-y-2 rounded border border-steel p-2">
            <h3 className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
              {t('skills.importExport')}
            </h3>
            <textarea
              value={importText}
              onChange={(event) => setImportText(event.target.value)}
              rows={4}
              placeholder={t('skills.importPlaceholder')}
              className="w-full rounded border border-steel bg-anvil p-2 font-mono text-[11px] text-slate-200 placeholder:text-slate-600"
            />
            <div className="flex gap-2">
              <Button
                variant="primary"
                disabled={importing || importText.trim() === ''}
                onClick={doFileImport}
              >
                {t('skills.import')}
              </Button>
              <Button disabled={importText.trim() === ''} onClick={doImport}>
                {t('skills.loadDraft')}
              </Button>
              <Button
                disabled={!selected}
                onClick={() =>
                  void exportSkill(selected?.name ?? '').then((markdown) =>
                    copy(markdown, t('skills.exported', { name: selected?.name ?? '' })),
                  )
                }
              >
                {t('skills.export')}
              </Button>
            </div>
            {status ? <p className="text-[11px] text-mint">{status}</p> : null}
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
            {selected ? t('skills.edit', { name: selected.name }) : t('skills.new')}
          </h3>
          <Field label={t('skills.name')} hint={t('skills.nameHint')}>
            <input
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              className="w-full rounded border border-steel bg-anvil px-2 py-1.5 font-mono text-xs text-slate-200"
            />
          </Field>
          <Field label={t('skills.description')}>
            <input
              value={draft.description}
              onChange={(event) => setDraft({ ...draft, description: event.target.value })}
              className="w-full rounded border border-steel bg-anvil px-2 py-1.5 text-xs text-slate-200"
            />
          </Field>
          <Field label={t('skills.triggers')} hint={t('skills.triggersHint')}>
            <input
              value={draft.triggers}
              onChange={(event) => setDraft({ ...draft, triggers: event.target.value })}
              className="w-full rounded border border-steel bg-anvil px-2 py-1.5 text-xs text-slate-200"
            />
          </Field>
          <Field label={t('skills.body')} hint={t('skills.bodyHint')}>
            <textarea
              value={draft.body}
              onChange={(event) => setDraft({ ...draft, body: event.target.value })}
              rows={10}
              className="w-full rounded border border-steel bg-anvil p-2 font-mono text-[11px] text-slate-200"
            />
          </Field>
          <div className="flex gap-2">
            <Button
              variant="primary"
              disabled={draft.name.trim() === '' || draft.description.trim() === ''}
              onClick={() =>
                void saveSkill({
                  name: draft.name.trim(),
                  description: draft.description.trim(),
                  triggers: draft.triggers
                    .split(',')
                    .map((entry) => entry.trim())
                    .filter(Boolean),
                  body: draft.body,
                }).then(() => setStatus(t('skills.saved', { name: draft.name })))
              }
            >
              {t('skills.save')}
            </Button>
            <Button
              variant="danger"
              disabled={!selected || selected.source === 'builtin'}
              onClick={() =>
                selected &&
                void deleteSkill(selected.name).then(() =>
                  setStatus(t('skills.deleted', { name: selected.name })),
                )
              }
            >
              {t('skills.delete')}
            </Button>
            <Button onClick={() => setDraft({ name: '', description: '', triggers: '', body: '' })}>
              {t('skills.clear')}
            </Button>
          </div>
          <p className="text-[11px] text-slate-600">{t('skills.footnote')}</p>
        </section>
      </div>
    </Modal>
  );
}
