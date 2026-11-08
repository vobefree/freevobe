import { readStorage, writeStorage } from './storage';
import { clampShare } from './theme';

/**
 * Panelayouten: vilken panel som ligger överst och hur höjden delas. Valen sparas lokalt, så
 * chatten och editorn står kvar där du lämnade dem nästa gång appen startar.
 */

export interface PaneLayout {
  chatFirst: boolean;
  chatShare: number;
}

export const PANE_FIRST_STORAGE_KEY = 'freevobe.paneFirst';
export const PANE_SHARE_STORAGE_KEY = 'freevobe.paneShare';

export function readPaneLayout(): PaneLayout {
  const storedShare = readStorage(PANE_SHARE_STORAGE_KEY);
  const parsed = storedShare === null ? 0.5 : Number.parseFloat(storedShare);
  return {
    chatFirst: readStorage(PANE_FIRST_STORAGE_KEY) === 'true',
    chatShare: clampShare(parsed),
  };
}

export function savePaneLayout(layout: PaneLayout): void {
  writeStorage(PANE_FIRST_STORAGE_KEY, String(layout.chatFirst));
  writeStorage(PANE_SHARE_STORAGE_KEY, String(clampShare(layout.chatShare)));
}
