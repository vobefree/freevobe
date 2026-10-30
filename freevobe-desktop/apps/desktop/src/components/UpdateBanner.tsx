import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './ui';
import { canUpdate, checkForUpdate, installUpdate, type UpdateInfo } from '../lib/updater';

/** Väntar tills appen hunnit ansluta innan den frågar efter en ny version. */
const CHECK_DELAY_MS = 4000;

/**
 * Erbjuder en nyare version när en sådan finns.
 *
 * Bannern syns bara i den installerade appen – i webbläsaren finns ingen uppdaterare. Att trycka
 * "Senare" gömmer den för sessionen; nästa start frågar igen.
 */
export function UpdateBanner() {
  const { t } = useTranslation();
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!canUpdate()) return;
    const timer = setTimeout(() => {
      void checkForUpdate().then((found) => {
        if (found) setUpdate(found);
      });
    }, CHECK_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  if (!update || dismissed) return null;

  const start = () => {
    setInstalling(true);
    setFailed(false);
    void installUpdate().catch(() => {
      setInstalling(false);
      setFailed(true);
    });
  };

  return (
    <aside
      data-testid="update-banner"
      className="vf-panel fixed right-3 bottom-8 z-40 w-80 space-y-2 p-3 text-xs shadow-2xl"
    >
      <p className="text-[13px] font-semibold text-slate-100">
        {t('update.available', { version: update.version })}
      </p>
      <p className="text-slate-500">{t('update.current', { version: update.currentVersion })}</p>
      {installing ? <p className="text-spark">{t('update.downloading')}</p> : null}
      {failed ? <p className="text-alert">{t('update.failed')}</p> : null}
      <div className="flex gap-2 pt-1">
        <Button variant="primary" disabled={installing} onClick={start}>
          {t('update.install')}
        </Button>
        <Button variant="ghost" disabled={installing} onClick={() => setDismissed(true)}>
          {t('update.later')}
        </Button>
      </div>
    </aside>
  );
}
