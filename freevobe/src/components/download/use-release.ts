'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import {
  detectPlatform,
  ensureRelease,
  getServerSnapshot,
  getSnapshot,
  refineMacArchitecture,
  subscribe,
  type Platform,
  type ReleaseState,
} from '@/lib/release';

/** Läser den delade release-statusen och ser till att ett anrop startas (en gång per sida). */
export function useRelease(): ReleaseState {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    ensureRelease();
  }, []);

  return state;
}

type PlatformState = {
  platform: Platform;
  /** true tills vi vet om användaren har en x64- eller arm-Mac. */
  resolving: boolean;
};

/** Plattformsval som börjar neutralt och förfinas efter hydrering (inga felaktiga länkar i SSR). */
export function usePlatform(): PlatformState {
  const [state, setState] = useState<PlatformState>({ platform: 'unknown', resolving: true });

  useEffect(() => {
    const detected = detectPlatform();
    setState({ platform: detected, resolving: false });

    let cancelled = false;
    void refineMacArchitecture(detected).then((refined) => {
      if (!cancelled && refined !== detected) setState({ platform: refined, resolving: false });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
