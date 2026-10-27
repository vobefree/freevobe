import {
  AndroidImportance,
  IosAuthorizationStatus,
  addNotificationResponseReceivedListener,
  getPermissionsAsync,
  requestPermissionsAsync,
  scheduleNotificationAsync,
  setNotificationChannelAsync,
  setNotificationHandler,
} from 'expo-notifications';
import { Platform } from 'react-native';
import { shouldShowBanner, type NotificationDecision, type NotificationKind } from './notify-rules';

/**
 * Lokala notiser via Expo Notifications.
 *
 * v1 använder *lokala* notiser: de skapas av appen när en händelse kommer in medan appen kör (i
 * förgrunden eller strax efter att den öppnats igen). Riktiga pushnotiser när appen är helt stängd
 * kräver en utvecklingsbygge och en vidarebefordran från datorn – se README.
 */

const CHANNEL_ID = 'freevobe-status';

/**
 * Notiser finns bara på iOS och Android. På webben kastar `scheduleNotificationAsync`
 * ("not available on web"), och ett sådant kast får aldrig fälla en körning som strömmar in i appen.
 * Därför är allt i den här filen "bäst av ansträngning": det som inte går att göra hoppas över.
 */
export function notificationsSupported(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

/** Hur en notis visas när appen redan är öppen. */
export function configureNotificationHandler(): void {
  if (!notificationsSupported()) return;
  setNotificationHandler({
    handleNotification: async (notification) => {
      const kind = (notification.request.content.data as { kind?: NotificationKind } | null)?.kind;
      // Samma regel som när notisen skapas: bara tidskritiska notiser tar över skärmen.
      const important = kind ? shouldShowBanner(kind) : false;
      return {
        shouldShowBanner: important,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      };
    },
  });
}

/** Android kräver en kanal innan behörigheten kan beviljas (API 33+). */
export async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Godkännanden och status',
      importance: AndroidImportance.DEFAULT,
      vibrationPattern: [0, 200, 120, 200],
    });
  } catch {
    // Kanalen finns redan, eller så saknas stöd – inget som hindrar resten av appen.
  }
}

export interface PermissionResult {
  granted: boolean;
  /** Text att visa i inställningarna när något inte gick igenom. */
  message: string;
}

export async function ensureNotificationPermission(): Promise<PermissionResult> {
  if (!notificationsSupported()) {
    return { granted: false, message: 'Notiser finns bara i iOS- och Android-appen.' };
  }

  await ensureAndroidChannel();

  try {
    const current = await getPermissionsAsync();
    if (current.granted) return { granted: true, message: 'Notiser är på.' };

    const requested = await requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });

    // På iOS räknas "provisional" som tillräckligt: notiserna hamnar tyst i notiscentret.
    const provisional = requested.ios?.status === IosAuthorizationStatus.PROVISIONAL;
    if (requested.granted || provisional) return { granted: true, message: 'Notiser är på.' };
  } catch {
    return { granted: false, message: 'Kunde inte läsa notisbehörigheten på den här enheten.' };
  }

  return {
    granted: false,
    message: 'Notiser är avstängda. Du kan slå på dem i telefonens inställningar.',
  };
}

/**
 * Visar en notis direkt. `trigger: null` betyder "nu".
 *
 * Kastar aldrig: anropas från händelseströmmen, och en notis som inte går att visa ska inte kunna
 * avbryta en körning. `shouldShowBanner` styr bara hur notisen presenteras, inte om den visas.
 */
export async function presentNotification(decision: NotificationDecision): Promise<void> {
  if (!notificationsSupported()) return;
  await ensureAndroidChannel();
  try {
    await scheduleNotificationAsync({
      content: {
        title: decision.title,
        body: decision.body,
        data: { kind: decision.kind, key: decision.key },
      },
      trigger: null,
    });
  } catch {
    // Behörighet saknas, kanalen är borta eller så stöds inte notiser här. Körningen fortsätter.
  }
}

/** När användaren trycker på en notis: skicka med data till skärmen som ska öppnas. */
export function addNotificationResponseListener(
  handler: (data: Record<string, unknown>) => void,
): () => void {
  if (!notificationsSupported()) return () => undefined;
  try {
    const subscription = addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      handler((data ?? {}) as Record<string, unknown>);
    });
    return () => subscription.remove();
  } catch {
    return () => undefined;
  }
}
