import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/appStore';
import { Button, Chip, Modal } from './ui';
import { clockTime } from '../lib/format';

const STATUS_TONE = { ok: 'mint', warn: 'ember', fail: 'alert' } as const;
const STATUS_KEY = {
  ok: 'doctor.status.ok',
  warn: 'doctor.status.warn',
  fail: 'doctor.status.fail',
} as const;

export function DoctorDialog() {
  const { t } = useTranslation();
  const open = useAppStore((state) => state.doctorOpen);
  const setOpen = useAppStore((state) => state.setDoctorOpen);
  const doctor = useAppStore((state) => state.doctor);
  const runDoctor = useAppStore((state) => state.runDoctor);

  if (!open) return null;

  return (
    <Modal
      title={t('doctor.title')}
      onClose={() => setOpen(false)}
      width="max-w-2xl"
      footer={
        <Button variant="primary" onClick={() => void runDoctor()}>
          {t('doctor.rerun')}
        </Button>
      }
    >
      {!doctor ? (
        <p className="text-sm text-slate-400">{t('doctor.checking')}</p>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Chip tone="mint">{t('doctor.ok', { count: doctor.summary.ok })}</Chip>
            <Chip tone="ember">{t('doctor.warn', { count: doctor.summary.warn })}</Chip>
            <Chip tone="alert">{t('doctor.fail', { count: doctor.summary.fail })}</Chip>
            <span className="ml-auto">{clockTime(doctor.generatedAt)}</span>
          </div>

          <ul className="space-y-1.5">
            {doctor.checks.map((check) => (
              <li key={check.id} className="rounded border border-steel p-2.5">
                <div className="flex items-center gap-2">
                  <Chip tone={STATUS_TONE[check.status]}>{t(STATUS_KEY[check.status])}</Chip>
                  <span className="text-[12.5px] font-medium text-slate-200">{check.label}</span>
                </div>
                <p className="mt-1 text-[11.5px] text-slate-400">{check.detail}</p>
                {check.fix ? (
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {t('doctor.fix', { fix: check.fix })}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  );
}
