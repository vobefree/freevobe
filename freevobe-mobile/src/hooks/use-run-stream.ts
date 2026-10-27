import { useEffect, useRef } from 'react';
import type { AgentEvent } from '@/api/types';
import { presentNotification } from '@/lib/notifications';
import { notificationFor } from '@/lib/notify-rules';
import { useRuns } from '@/state/run';
import { useSettings } from '@/state/settings';
import { useApi } from './use-api';

/**
 * Prenumererar på en körning och lägger händelserna i körningsvyn. Notiser skickas för de händelser
 * som reglerna säger till om – och bara en gång per händelse, även om strömmen spelar upp den igen.
 */
export function useRunStream(sessionId: string | undefined, runId: string | null): void {
  const api = useApi();
  const apply = useRuns((state) => state.apply);
  const notifications = useSettings((state) => state.notifications);
  const notified = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!sessionId || !runId) return undefined;
    const unsubscribe = api.subscribeToRun(runId, (event: AgentEvent) => {
      apply(sessionId, event);
      const decision = notificationFor(event, notifications);
      if (!decision || notified.current.has(decision.key)) return;
      notified.current.add(decision.key);
      // En notis är en sidoeffekt: den får aldrig kasta in i händelseströmmen.
      void presentNotification(decision).catch(() => undefined);
    });
    return unsubscribe;
  }, [api, sessionId, runId, apply, notifications]);
}

/**
 * Håller koll på väntande godkännanden även när användaren står på en annan flik, så att en notis
 * kommer så snart agenten fastnar. Dedupliceringen ligger i minnet: en notis per godkännande.
 */
export function useApprovalWatcher(approvals: { id: string }[] | undefined, enabled: boolean): void {
  const notifications = useSettings((state) => state.notifications);
  const notified = useRef<Set<string>>(new Set());
  const primed = useRef(false);

  useEffect(() => {
    if (!enabled || !approvals) return;

    // Vid första inläsningen visas en sammanfattning i stället för en notis per gammalt ärende.
    if (!primed.current) {
      primed.current = true;
      for (const approval of approvals) notified.current.add(approval.id);
      return;
    }

    for (const approval of approvals) {
      if (notified.current.has(approval.id)) continue;
      notified.current.add(approval.id);
      if (!notifications.enabled || !notifications.approvals) continue;
      void presentNotification({
        kind: 'approval',
        title: 'Freevobe behöver ett godkännande',
        body: approval.id,
        key: `approval.${approval.id}`,
      }).catch(() => undefined);
    }
  }, [approvals, enabled, notifications]);
}
