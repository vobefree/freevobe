import { useTranslation } from 'react-i18next';
import type { ProviderId } from '@freevobe/protocol';
import { useAppStore } from '../../store/appStore';
import { Button } from '../ui';

/**
 * Banner i chatten när en beställning kräver en provider som inte är påslagen.
 *
 * Servern skickar bara id:n och orsaken – texten bor i locale-filerna. Knapparna slår på
 * providern direkt; API-nyckeln fyller användaren sedan i under Inställningar → Providers.
 */
export function ProviderNotice() {
  const { t } = useTranslation();
  const notice = useAppStore((state) => state.providerNotice);
  const setProviderEnabled = useAppStore((state) => state.setProviderEnabled);
  const dismiss = useAppStore((state) => state.dismissProviderNotice);

  if (!notice) return null;

  return (
    <div
      data-testid="provider-notice"
      className="space-y-2 rounded border border-ember/40 bg-ember/5 p-3"
    >
      <p className="text-xs text-slate-300">
        {t(
          notice.reason === 'local_only'
            ? 'providers.required.localOnly'
            : 'providers.required.notConfigured',
        )}
      </p>
      <div className="flex flex-wrap gap-2">
        {notice.providers.map((id) => (
          <Button
            key={id}
            variant="primary"
            testId={`provider-required-${id}`}
            onClick={() => void setProviderEnabled(id as ProviderId, true)}
          >
            {t('providers.required.enable', { provider: t(`providers.name.${id}`) })}
          </Button>
        ))}
        <Button testId="provider-notice-dismiss" onClick={dismiss}>
          {t('providers.required.dismiss')}
        </Button>
      </div>
    </div>
  );
}
