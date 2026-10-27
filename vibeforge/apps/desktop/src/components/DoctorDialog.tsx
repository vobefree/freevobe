import { useAppStore } from '../store/appStore';
import { Button, Chip, Modal } from './ui';
import { clockTime } from '../lib/format';

const STATUS_TONE = { ok: 'mint', warn: 'ember', fail: 'alert' } as const;
const STATUS_LABEL = { ok: 'ok', warn: 'varning', fail: 'fel' } as const;

export function DoctorDialog() {
  const open = useAppStore((state) => state.doctorOpen);
  const setOpen = useAppStore((state) => state.setDoctorOpen);
  const doctor = useAppStore((state) => state.doctor);
  const runDoctor = useAppStore((state) => state.runDoctor);

  if (!open) return null;

  return (
    <Modal
      title="Doctor – kontroll av utvecklingsmiljön"
      onClose={() => setOpen(false)}
      width="max-w-2xl"
      footer={
        <Button variant="primary" onClick={() => void runDoctor()}>
          Kör om kontrollen
        </Button>
      }
    >
      {!doctor ? (
        <p className="text-sm text-slate-400">
          Kontrollerar Node, Git, Ollama, modell, diskutrymme, behörigheter och MCP…
        </p>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Chip tone="mint">{doctor.summary.ok} ok</Chip>
            <Chip tone="ember">{doctor.summary.warn} varningar</Chip>
            <Chip tone="alert">{doctor.summary.fail} fel</Chip>
            <span className="ml-auto">{clockTime(doctor.generatedAt)}</span>
          </div>

          <ul className="space-y-1.5">
            {doctor.checks.map((check) => (
              <li key={check.id} className="rounded border border-steel p-2.5">
                <div className="flex items-center gap-2">
                  <Chip tone={STATUS_TONE[check.status]}>{STATUS_LABEL[check.status]}</Chip>
                  <span className="text-[12.5px] font-medium text-slate-200">{check.label}</span>
                </div>
                <p className="mt-1 text-[11.5px] text-slate-400">{check.detail}</p>
                {check.fix ? (
                  <p className="mt-0.5 text-[11px] text-slate-500">Åtgärd: {check.fix}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  );
}
