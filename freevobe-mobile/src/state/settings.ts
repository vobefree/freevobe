import { create } from 'zustand';
import { defaultNotifications, type NotificationPreferences } from '@/lib/notify-rules';
import { readJson, storageKeys, writeJson } from '@/lib/secure';

// Notisreglerna äger sina inställningar; här finns bara lagringen.
export { defaultNotifications } from '@/lib/notify-rules';
export type { NotificationPreferences } from '@/lib/notify-rules';

/**
 * Appens egna inställningar. Ligger i samma säkra lagring som resten, men innehåller inga
 * hemligheter – det är bara praktiskt att ha allt på ett ställe.
 */

export type ThemeMode = 'system' | 'dark' | 'light';

export interface SettingsState {
  ready: boolean;
  themeMode: ThemeMode;
  notifications: NotificationPreferences;
  /** Använd mock-adaptern även med en parad dator (för att visa appen utan risk). */
  demoMode: boolean;

  hydrate: () => Promise<void>;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  setNotification: <K extends keyof NotificationPreferences>(
    key: K,
    value: NotificationPreferences[K],
  ) => Promise<void>;
  setDemoMode: (enabled: boolean) => Promise<void>;
}

interface PersistedSettings {
  themeMode?: ThemeMode;
  notifications?: Partial<NotificationPreferences>;
  demoMode?: boolean;
}

export const useSettings = create<SettingsState>((set, get) => {
  const persist = async () => {
    const { themeMode, notifications, demoMode } = get();
    await writeJson(storageKeys.settings, { themeMode, notifications, demoMode });
  };

  return {
    ready: false,
    themeMode: 'dark',
    notifications: defaultNotifications,
    demoMode: false,

    async hydrate() {
      const stored = await readJson<PersistedSettings>(storageKeys.settings);
      set({
        themeMode: stored?.themeMode ?? 'dark',
        notifications: { ...defaultNotifications, ...stored?.notifications },
        demoMode: stored?.demoMode ?? false,
        ready: true,
      });
    },

    async setThemeMode(mode) {
      set({ themeMode: mode });
      await persist();
    },

    async setNotification(key, value) {
      set((state) => ({ notifications: { ...state.notifications, [key]: value } }));
      await persist();
    },

    async setDemoMode(enabled) {
      set({ demoMode: enabled });
      await persist();
    },
  };
});
