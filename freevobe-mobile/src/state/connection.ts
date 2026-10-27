import { create } from 'zustand';
import type { ConnectionStatus, SavedDesktop } from '@/api/types';
import { newId } from '@/lib/format';
import { readJson, removeSecret, storageKeys, writeJson } from '@/lib/secure';

/**
 * Anslutna datorer, aktiv dator och status.
 *
 * Parningsnycklarna ligger i nyckelringen (SecureStore) och indexet – labels och adresser, utan
 * nycklar – i en egen post. Det håller varje värde litet, vilket iOS kräver, och gör att en läckt
 * lista inte avslöjar några hemligheter.
 */

export interface DesktopIndex {
  desktops: Omit<SavedDesktop, 'token'>[];
  activeId: string | null;
  projectId: string | null;
}

const emptyIndex: DesktopIndex = { desktops: [], activeId: null, projectId: null };

export interface ConnectionState extends DesktopIndex {
  /** Sant när indexet är läst från lagringen. */
  ready: boolean;
  status: ConnectionStatus;
  /** Token för den aktiva datorn, läst ur nyckelringen. Lämnar aldrig appen. */
  activeToken: string | null;
  lastError: string | null;

  hydrate: () => Promise<void>;
  addDesktop: (input: { label: string; url: string; token: string }) => Promise<SavedDesktop>;
  removeDesktop: (id: string) => Promise<void>;
  selectDesktop: (id: string) => Promise<void>;
  selectProject: (projectId: string) => Promise<void>;
  setStatus: (status: ConnectionStatus, lastError?: string | null) => void;
  /** Kopplar bort den aktiva datorn men behåller den i listan. */
  disconnect: () => Promise<void>;
}

// Demoläget ligger i inställningarna (src/state/settings.ts) och inte här: ett läge, en källa.

export const useConnection = create<ConnectionState>((set, get) => {
  /** Skriver indexet utan att röra nyckelringen. */
  const persistIndex = async () => {
    const { desktops, activeId, projectId } = get();
    await writeJson(storageKeys.connectionIndex, { desktops, activeId, projectId });
  };

  return {
    ...emptyIndex,
    ready: false,
    status: 'disconnected',
    activeToken: null,
    lastError: null,

    async hydrate() {
      const stored = await readJson<DesktopIndex>(storageKeys.connectionIndex);
      const index = stored ?? emptyIndex;
      const cached = index.activeId
        ? await readJson<{ token: string }>(storageKeys.desktop(index.activeId))
        : null;
      const activeToken = cached?.token ?? null;

      set({
        desktops: index.desktops,
        // En activeId utan token i nyckelringen är obrukbar: be då om parning i stället.
        activeId: activeToken ? index.activeId : null,
        projectId: index.projectId,
        activeToken,
        ready: true,
        status: 'disconnected',
        lastError:
          index.activeId && !activeToken
            ? 'Parningskoden för den datorn finns inte längre. Para ihop igen.'
            : null,
      });
    },

    async addDesktop(input) {
      const desktop: SavedDesktop = {
        id: newId('desktop'),
        label: input.label.trim() || 'Min dator',
        url: input.url,
        token: input.token,
        addedAt: Date.now(),
      };
      // Varje dator i sin egen nyckelringspost: små värden och en token per post.
      await writeJson(storageKeys.desktop(desktop.id), { token: desktop.token });
      set((state) => ({
        desktops: [...state.desktops, stripToken(desktop)],
        activeId: desktop.id,
        activeToken: desktop.token,
        status: 'connecting',
        lastError: null,
      }));
      await persistIndex();
      return desktop;
    },

    async removeDesktop(id) {
      await removeSecret(storageKeys.desktop(id));
      set((state) => ({
        desktops: state.desktops.filter((desktop) => desktop.id !== id),
        activeId: state.activeId === id ? null : state.activeId,
        activeToken: state.activeId === id ? null : state.activeToken,
        status: state.activeId === id ? 'disconnected' : state.status,
      }));
      await persistIndex();
    },

    async selectDesktop(id) {
      const entry = await readJson<{ token: string }>(storageKeys.desktop(id));
      set({
        activeId: entry ? id : null,
        activeToken: entry?.token ?? null,
        status: entry ? 'connecting' : 'disconnected',
        lastError: entry ? null : 'Parningskoden för den datorn finns inte längre. Para ihop igen.',
      });
      await persistIndex();
    },

    async selectProject(projectId) {
      set({ projectId });
      await persistIndex();
    },

    setStatus(status, lastError = null) {
      set({ status, lastError });
    },

    async disconnect() {
      set({ activeId: null, activeToken: null, status: 'disconnected', lastError: null });
      await persistIndex();
    },
  };
});

function stripToken(desktop: SavedDesktop): Omit<SavedDesktop, 'token'> {
  const { token: _token, ...rest } = desktop;
  return rest;
}
