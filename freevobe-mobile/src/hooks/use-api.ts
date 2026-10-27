import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getApi, type FreevobeApi } from '@/api';
import type { SavedDesktop } from '@/api/types';
import { useConnection } from '@/state/connection';
import { useSettings } from '@/state/settings';

/**
 * Klienten för den aktiva anslutningen. Den är delad av alla hooks (se `getApi` i src/api/index.ts),
 * så att en körning som startas i chatten hörs av godkännandelistan och loggarna också.
 *
 * Mock och riktig dator har samma gränssnitt, så skärmarna bryr sig bara om data – aldrig om var den
 * kommer ifrån.
 */
export function useApi(): FreevobeApi {
  const desktops = useConnection((state) => state.desktops);
  const activeId = useConnection((state) => state.activeId);
  const activeToken = useConnection((state) => state.activeToken);
  const projectId = useConnection((state) => state.projectId);
  const demoMode = useSettings((state) => state.demoMode);

  const entry = desktops.find((desktop) => desktop.id === activeId) ?? null;
  const desktop: SavedDesktop | null = entry && activeToken ? { ...entry, token: activeToken } : null;

  return getApi({ desktop, projectId, forceMock: demoMode });
}

/** Nycklarna innehåller klientens identitet, så att data från en dator aldrig blandas med en annan. */
export const queryKeys = {
  snapshot: (api: FreevobeApi) => ['snapshot', api.mode] as const,
  missions: (api: FreevobeApi) => ['missions', api.mode] as const,
  mission: (api: FreevobeApi, id: string) => ['mission', api.mode, id] as const,
  approvals: (api: FreevobeApi) => ['approvals', api.mode] as const,
  logs: (api: FreevobeApi, sessionId?: string) => ['logs', api.mode, sessionId ?? 'all'] as const,
};

export function useSnapshot(enabled = true) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.snapshot(api),
    queryFn: () => api.snapshot(),
    enabled,
    staleTime: 15_000,
  });
}

export function useMissions(enabled = true) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.missions(api),
    queryFn: () => api.missions(),
    enabled,
    refetchInterval: 15_000,
  });
}

export function useMission(sessionId: string | undefined) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.mission(api, sessionId ?? ''),
    queryFn: () => api.mission(sessionId as string),
    enabled: Boolean(sessionId),
  });
}

export function useApprovals(enabled = true) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.approvals(api),
    queryFn: () => api.approvals(),
    enabled,
    refetchInterval: 8_000,
  });
}

export function useLogs(sessionId?: string) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.logs(api, sessionId),
    queryFn: () => api.logs(sessionId),
  });
}

/** Skickar en prompt och ogiltigförklarar det som ändras av en körning. */
export function useSendPrompt() {
  const api = useApi();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { sessionId: string; prompt: string }) => api.sendPrompt(input),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['mission'] });
      void client.invalidateQueries({ queryKey: ['missions'] });
    },
  });
}

export function useResolveApproval() {
  const api = useApi();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      approvalId: string;
      decision: 'approved' | 'rejected';
      rememberForSession?: boolean;
    }) => api.resolveApproval(input.approvalId, { decision: input.decision }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['approvals'] });
      void client.invalidateQueries({ queryKey: ['mission'] });
      void client.invalidateQueries({ queryKey: ['missions'] });
      void client.invalidateQueries({ queryKey: ['snapshot'] });
    },
  });
}

export function useAbortRun() {
  const api = useApi();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (runId: string) => api.abortRun(runId),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['missions'] });
    },
  });
}
