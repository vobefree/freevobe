import type { AgentEvent } from '@/api/types';
import { approvalSummary } from './approvals';

/**
 * Vilka notiser användaren vill ha. Typen bor här – tillsammans med reglerna – så att reglerna kan
 * testas utan att dra in inställningsstoren och därmed native-moduler.
 */
export interface NotificationPreferences {
  /** Huvudbrytare: stäng av alla notiser från appen. */
  enabled: boolean;
  /** Agenten behöver ett godkännande. */
  approvals: boolean;
  /** En mission är klar. */
  missionDone: boolean;
  /** Ett test misslyckades. */
  testFailure: boolean;
  /** Agenten stötte på ett fel. */
  errors: boolean;
}

export const defaultNotifications: NotificationPreferences = {
  enabled: true,
  approvals: true,
  missionDone: true,
  testFailure: true,
  errors: true,
};

/**
 * Vilka händelser som blir en notis, och vad den ska säga.
 *
 * Ren funktion utan Expo-beroenden: vilka notiser som får skickas är affärslogik, medan själva
 * schemaläggningen ligger i `notifications.ts`. Det gör reglerna testbara.
 */

export type NotificationKind = 'approval' | 'mission-done' | 'test-failure' | 'error';

export interface NotificationDecision {
  kind: NotificationKind;
  title: string;
  body: string;
  /** Identitet för att undvika dubbletter när strömmen spelar upp samma händelse igen. */
  key: string;
}

export function notificationFor(
  event: AgentEvent,
  preferences: NotificationPreferences,
): NotificationDecision | null {
  if (!preferences.enabled) return null;

  switch (event.type) {
    case 'approval_request':
      if (!preferences.approvals) return null;
      return {
        kind: 'approval',
        title: 'Freevobe behöver ett godkännande',
        body: `${event.request.title} – ${approvalSummary(event.request)}`,
        key: `approval.${event.request.id}`,
      };

    case 'tests':
      if (event.tests.failed === 0 || !preferences.testFailure) return null;
      return {
        kind: 'test-failure',
        title: `${event.tests.failed} test misslyckades`,
        body: event.tests.command,
        key: `tests.${event.runId}.${event.tests.createdAt}`,
      };

    case 'error':
      if (!preferences.errors) return null;
      return {
        kind: 'error',
        title: 'Freevobe stötte på ett fel',
        body: event.message,
        key: `error.${event.runId}.${event.code}`,
      };

    case 'run_finished':
      if (event.reason !== 'final' || !preferences.missionDone) return null;
      return {
        kind: 'mission-done',
        title: 'Missionen är klar',
        body: event.summary ?? 'Agenten har avslutat körningen.',
        key: `done.${event.runId}`,
      };

    default:
      return null;
  }
}

/** Sant när notisen ska visas även med appen i förgrunden. */
export function shouldShowBanner(kind: NotificationKind): boolean {
  // Ett godkännande eller fel är tidskritiskt; ett avslutat mission kan vänta tills appen öppnas.
  return kind === 'approval' || kind === 'error' || kind === 'test-failure';
}
