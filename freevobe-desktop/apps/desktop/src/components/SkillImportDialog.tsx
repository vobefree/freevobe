import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FREEVOBE_SKILLS_DIR,
  type SkillFormatSource,
  type SkillImportItem,
  type SkillImportScan,
  type SkillRiskLevel,
} from '@freevobe/protocol';
import { useAppStore } from '../store/appStore';
import { Button, Chip, Modal } from './ui';

/** Källnamnen är egennamn och översätts därför inte. */
export const SOURCE_LABELS: Record<SkillFormatSource, string> = {
  claude: 'Claude',
  cursor: 'Cursor',
  agents_md: 'AGENTS.md',
  copilot: 'Copilot',
  codex: 'Codex',
  opencode: 'OpenCode',
  windsurf: 'Windsurf',
  cline: 'Cline',
  generic: 'Markdown',
};

const RISK_KEYS: Record<SkillRiskLevel, string> = {
  safe: 'skills.security.safe',
  warning: 'skills.security.warning',
  dangerous: 'skills.security.dangerous',
};

/** Träffarna grupperas så att listan blir läsbar även när en skill har många noteringar. */
const FINDING_GROUPS: Record<string, string> = {
  override_instructions: 'override',
  hide_from_user: 'override',
  pipe_to_shell: 'code',
  destructive_command: 'code',
  privileged_command: 'code',
  dynamic_execution: 'code',
  credential_access: 'secrets',
  exfiltration: 'secrets',
  encoded_blob: 'secrets',
  hidden_characters: 'secrets',
  network_install: 'secrets',
  script_reference: 'scripts',
  external_url: 'links',
};

function findingLabelKey(code: string): string {
  const group = FINDING_GROUPS[code] ?? 'secrets';
  return `skills.security.group.${group}`;
}

type Busy = 'scan' | 'apply' | null;

export function SkillImportDialog() {
  const { t } = useTranslation();
  const open = useAppStore((state) => state.skillImportOpen);
  const setOpen = useAppStore((state) => state.setSkillImportOpen);
  const scanSkillImport = useAppStore((state) => state.scanSkillImport);
  const applySkillImport = useAppStore((state) => state.applySkillImport);

  const [target, setTarget] = useState('');
  const [scan, setScan] = useState<SkillImportScan | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [riskAck, setRiskAck] = useState<string[]>([]);
  const [scriptAck, setScriptAck] = useState<string[]>([]);
  const [busy, setBusy] = useState<Busy>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const groups = useMemo(() => {
    if (!scan) return [] as [SkillFormatSource, SkillImportItem[]][];
    const bySource = new Map<SkillFormatSource, SkillImportItem[]>();
    for (const item of scan.items) {
      const list = bySource.get(item.source) ?? [];
      list.push(item);
      bySource.set(item.source, list);
    }
    return [...bySource.entries()];
  }, [scan]);

  if (!open) return null;

  const needsRiskAck = (item: SkillImportItem) => item.security.level === 'dangerous';
  const needsScriptAck = (item: SkillImportItem) => item.security.scripts.length > 0;

  /** En post får bara väljas när alla spärrar den kräver är uppfyllda. */
  const allowed = (item: SkillImportItem) =>
    !item.conflict &&
    (!needsRiskAck(item) || riskAck.includes(item.path)) &&
    (!needsScriptAck(item) || scriptAck.includes(item.path));

  const selectable = scan?.items.filter(allowed) ?? [];
  const allSelected = selectable.length > 0 && selected.length === selectable.length;
  const conflicts = scan?.items.filter((item) => item.conflict).length ?? 0;
  const blocked = scan?.items.filter((item) => !item.conflict && !allowed(item)).length ?? 0;

  const chosen = (scan?.items ?? []).filter((item) => selected.includes(item.path) && allowed(item));
  const chosenScripts = new Set(chosen.flatMap((item) => item.security.scripts));
  const chosenUrls = new Set(chosen.flatMap((item) => item.security.urls));

  const toggle = (pathname: string) => {
    setSelected((current) =>
      current.includes(pathname)
        ? current.filter((entry) => entry !== pathname)
        : [...current, pathname],
    );
  };

  const acknowledgeRisk = (item: SkillImportItem, value: boolean) => {
    setRiskAck((current) =>
      value ? [...current, item.path] : current.filter((entry) => entry !== item.path),
    );
    if (value) setSelected((current) => (current.includes(item.path) ? current : [...current, item.path]));
    else setSelected((current) => current.filter((entry) => entry !== item.path));
  };

  const acknowledgeScripts = (item: SkillImportItem, value: boolean) => {
    setScriptAck((current) =>
      value ? [...current, item.path] : current.filter((entry) => entry !== item.path),
    );
    if (!value) setSelected((current) => current.filter((entry) => entry !== item.path));
  };

  const reset = () => {
    setScan(null);
    setSelected([]);
    setRiskAck([]);
    setScriptAck([]);
  };

  const runScan = () => {
    setBusy('scan');
    setError(null);
    setStatus(null);
    setScan(null);
    setSelected([]);
    setRiskAck([]);
    setScriptAck([]);
    void (async () => {
      try {
        const result = await scanSkillImport(target);
        setScan(result);
        // Bara de poster som inte kräver ett extra medgivande väljs i förväg.
        setSelected(
          result.items
            .filter(
              (item) =>
                !item.conflict &&
                item.security.level !== 'dangerous' &&
                item.security.scripts.length === 0,
            )
            .map((item) => item.path),
        );
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : String(caught));
      } finally {
        setBusy(null);
      }
    })();
  };

  const runApply = () => {
    if (!scan || chosen.length === 0) return;
    setBusy('apply');
    setError(null);
    void (async () => {
      try {
        const result = await applySkillImport(
          chosen.map((item) => ({
            name: item.name,
            description: item.description,
            tools: item.tools,
            triggers: item.triggers,
            globs: item.globs,
            alwaysApply: item.alwaysApply,
            body: item.body,
            source: item.source,
            sourcePath: item.path,
            ...(item.sourceRepo ? { sourceRepo: item.sourceRepo } : {}),
            ...(item.author ? { author: item.author } : {}),
            ...(item.sourceUrl ? { sourceUrl: item.sourceUrl } : {}),
          })),
        );
        reset();
        setStatus(
          t('skills.import.done', { count: result.created.length, dir: FREEVOBE_SKILLS_DIR }),
        );
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : String(caught));
      } finally {
        setBusy(null);
      }
    })();
  };

  return (
    <Modal title={t('skills.import.title')} onClose={() => setOpen(false)} width="max-w-3xl">
      <p className="mb-3 text-xs text-slate-500">{t('skills.import.intro')}</p>

      <div className="flex items-end gap-2">
        <label className="flex-1 text-[11px] text-slate-400">
          {t('skills.import.target')}
          <input
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            placeholder={t('skills.import.targetPlaceholder')}
            className="mt-1 w-full rounded border border-steel bg-anvil px-2 py-1.5 font-mono text-xs text-slate-200 placeholder:text-slate-600"
          />
        </label>
        <Button variant="primary" disabled={busy !== null} onClick={runScan}>
          {busy === 'scan' ? t('skills.import.scanning') : t('skills.import.scan')}
        </Button>
      </div>

      {error ? <p className="mt-3 text-[11.5px] text-ember">{error}</p> : null}
      {status ? <p className="mt-3 text-[11.5px] text-mint">{status}</p> : null}

      {scan ? (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-300">
              {t('skills.import.found', {
                count: scan.items.length,
                sources: scan.bySource.length,
              })}
            </span>
            <span className="text-[11px] text-slate-600">
              {t('skills.import.selected', { count: chosen.length })}
            </span>
            <span className="ml-auto truncate font-mono text-[10px] text-slate-600">
              {scan.target}
            </span>
          </div>

          {scan.items.length === 0 ? (
            <p className="text-[11.5px] text-slate-500">{t('skills.import.empty')}</p>
          ) : (
            <>
              <label className="flex cursor-pointer items-center gap-2 text-[11.5px] text-slate-400">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() =>
                    setSelected(allSelected ? [] : selectable.map((item) => item.path))
                  }
                />
                {t('skills.import.selectAll')}
              </label>

              <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
                {groups.map(([source, items]) => (
                  <div key={source}>
                    <h4 className="mb-1 flex items-center gap-2 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
                      {SOURCE_LABELS[source]}
                      <span className="text-[10px] font-normal text-slate-600">{items.length}</span>
                    </h4>
                    <ul className="space-y-1">
                      {items.map((item) => {
                        const risk = item.security;
                        return (
                          <li key={item.path}>
                            <div
                              className={`rounded border p-2 ${
                                item.conflict ? 'border-steel/60 opacity-70' : 'border-steel'
                              }`}
                            >
                              <label className="flex cursor-pointer items-start gap-2">
                                <input
                                  type="checkbox"
                                  className="mt-0.5"
                                  disabled={!allowed(item)}
                                  checked={selected.includes(item.path) && allowed(item)}
                                  onChange={() => toggle(item.path)}
                                />
                                <span className="min-w-0 flex-1">
                                  <span className="flex flex-wrap items-center gap-1.5">
                                    <span className="text-[12px] font-medium text-slate-200">
                                      {item.name}
                                    </span>
                                    <Chip tone="neutral">
                                      {t('skills.provenance.from', {
                                        source: SOURCE_LABELS[item.source],
                                      })}
                                    </Chip>
                                    <Chip tone={risk.level === 'safe' ? 'neutral' : 'ember'}>
                                      {t(RISK_KEYS[risk.level])}
                                    </Chip>
                                    {item.author ? (
                                      <span className="text-[10px] text-slate-600">
                                        {t('skills.provenance.author', { author: item.author })}
                                      </span>
                                    ) : null}
                                    {item.conflict ? (
                                      <Chip tone="ember">{t('skills.import.conflict')}</Chip>
                                    ) : null}
                                    {item.warnings.length > 0 ? (
                                      <span className="text-[10px] text-slate-600">
                                        {t('skills.import.warning', { count: item.warnings.length })}
                                      </span>
                                    ) : null}
                                  </span>
                                  <span className="mt-0.5 block text-[11px] text-slate-500">
                                    {item.description}
                                  </span>
                                  <span className="mt-0.5 flex flex-wrap items-center gap-2 font-mono text-[10px] text-slate-600">
                                    <span className="truncate">{item.path}</span>
                                    {item.sourceUrl ? (
                                      <a
                                        href={item.sourceUrl}
                                        target="_blank"
                                        rel="noreferrer noopener"
                                        className="underline hover:text-slate-300"
                                      >
                                        {t('skills.provenance.open')}
                                      </a>
                                    ) : null}
                                  </span>
                                </span>
                              </label>

                              <div className="mt-1.5 space-y-1 border-t border-steel/60 pt-1.5 pl-6">
                                <p className="text-[10px] text-slate-500">
                                  {t('skills.security.score', { score: risk.score })} ·{' '}
                                  {t('skills.security.findings', { count: risk.findings.length })}
                                </p>

                                {risk.findings.length > 0 ? (
                                  <ul className="space-y-0.5">
                                    {risk.findings.slice(0, 6).map((finding, index) => (
                                      <li
                                        key={`${finding.code}-${finding.line}-${index}`}
                                        className={`text-[10.5px] ${
                                          finding.level === 'dangerous'
                                            ? 'text-ember'
                                            : 'text-slate-400'
                                        }`}
                                      >
                                        {t(findingLabelKey(finding.code))} ·{' '}
                                        <span className="font-mono">rad {finding.line}</span> –{' '}
                                        {finding.excerpt}
                                      </li>
                                    ))}
                                  </ul>
                                ) : null}

                                {risk.scripts.length > 0 ? (
                                  <>
                                    <p className="text-[10.5px] text-slate-400">
                                      {t('skills.security.scripts', {
                                        list: risk.scripts.join(', '),
                                      })}
                                    </p>
                                    <label className="flex cursor-pointer items-center gap-2 text-[10.5px] text-slate-300">
                                      <input
                                        type="checkbox"
                                        checked={scriptAck.includes(item.path)}
                                        onChange={(event) =>
                                          acknowledgeScripts(item, event.target.checked)
                                        }
                                      />
                                      {t('skills.security.scriptAck')}
                                    </label>
                                  </>
                                ) : null}

                                {risk.urls.length > 0 ? (
                                  <p className="text-[10.5px] text-slate-400">
                                    {t('skills.security.urls', { list: risk.urls.join(', ') })}
                                  </p>
                                ) : null}

                                {needsRiskAck(item) ? (
                                  <div className="rounded border border-ember/50 p-1.5">
                                    <p className="text-[10.5px] text-ember">
                                      {t('skills.security.dangerousBlocked')}
                                    </p>
                                    <label className="mt-1 flex cursor-pointer items-center gap-2 text-[10.5px] text-slate-200">
                                      <input
                                        type="checkbox"
                                        checked={riskAck.includes(item.path)}
                                        onChange={(event) =>
                                          acknowledgeRisk(item, event.target.checked)
                                        }
                                      />
                                      {t('skills.security.ack')}
                                    </label>
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>

              {conflicts > 0 ? (
                <p className="text-[11px] text-slate-500">
                  {t('skills.import.conflictHint', { count: conflicts })}
                </p>
              ) : null}
              {blocked > 0 ? (
                <p className="text-[11px] text-ember">
                  {t('skills.security.blockedCount', { count: blocked })}
                </p>
              ) : null}
              {scan.unknown.length > 0 ? (
                <p className="text-[11px] text-slate-600">
                  {t('skills.import.unknown', { count: scan.unknown.length })}
                </p>
              ) : null}

              <p className="text-[11px] text-slate-500">
                {t('skills.import.summary', {
                  files: chosen.length,
                  scripts: chosenScripts.size,
                  urls: chosenUrls.size,
                })}
              </p>

              <Button
                variant="primary"
                disabled={busy !== null || chosen.length === 0}
                onClick={runApply}
              >
                {t('skills.import.apply')}
              </Button>
            </>
          )}
        </div>
      ) : null}
    </Modal>
  );
}
