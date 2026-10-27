import { create } from 'zustand';

/**
 * Vilken mission användaren arbetar med. Chatt-, logg- och godkännandeflikarna följer samma val, så
 * att telefonen känns som en fjärrkontroll till *en* session i taget.
 */
export interface ActiveSessionState {
  activeSessionId: string | null;
  select: (sessionId: string | null) => void;
}

export const useActiveSession = create<ActiveSessionState>((set) => ({
  activeSessionId: null,
  select: (activeSessionId) => set({ activeSessionId }),
}));
