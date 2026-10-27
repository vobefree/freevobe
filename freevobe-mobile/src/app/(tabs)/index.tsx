import { router } from 'expo-router';
import { RefreshControl, View } from 'react-native';
import { spacing } from '@/constants/theme';
import { useApprovalWatcher } from '@/hooks/use-run-stream';
import { useApprovals, useMissions, useSnapshot } from '@/hooks/use-api';
import { useTheme } from '@/lib/theme';
import { useConnection } from '@/state/connection';
import { useSettings } from '@/state/settings';
import { MissionCard, StatusCard } from '@/components/cards';
import { Body, Caption, Card, EmptyState, Screen, SectionTitle } from '@/components/ui';

/**
 * Hem: datorns status högst upp och alla missions under. Aktiva och väntande missions ligger först
 * eftersom det är dem användaren kan behöva göra något med.
 */
export default function MissionsScreen() {
  const theme = useTheme();
  const status = useConnection((state) => state.status);
  const lastError = useConnection((state) => state.lastError);
  const activeId = useConnection((state) => state.activeId);
  const disconnect = useConnection((state) => state.disconnect);
  const demoMode = useSettings((state) => state.demoMode);

  const snapshot = useSnapshot(true);
  const missions = useMissions(true);
  const approvals = useApprovals(true);

  // Notiser även när användaren står här i stället för i godkännandelistan.
  useApprovalWatcher(approvals.data, !demoMode && status === 'connected');

  const list = missions.data ?? [];
  const needsYou = list.filter((mission) => mission.status === 'waiting-approval');
  const active = list.filter((mission) => mission.status === 'running');
  const rest = list.filter(
    (mission) => mission.status !== 'waiting-approval' && mission.status !== 'running',
  );

  return (
    <Screen
      contentStyle={{ paddingBottom: spacing.xxxl }}
      refreshControl={
        <RefreshControl
          refreshing={missions.isFetching}
          onRefresh={() => {
            void missions.refetch();
            void snapshot.refetch();
            void approvals.refetch();
          }}
          tintColor={theme.accent}
        />
      }
    >
      <View>
        <Caption muted={false}>Freevobe Mobile</Caption>
        <Body muted>Styr din lokala agent från telefonen.</Body>
      </View>

      <StatusCard
        status={status}
        snapshot={snapshot.data}
        demo={demoMode}
        error={lastError}
        onConnect={() => router.push('/connect')}
        onDisconnect={() => void disconnect()}
      />

      {!demoMode && activeId === null ? (
        <Card tone="accent">
          <Body>
            Ingen dator är ihopparad ännu. Öppna Freevobe Desktop och välj “Mobile” för att visa
            QR-koden.
          </Body>
        </Card>
      ) : null}

      {missions.isLoading ? (
        <Caption>Hämtar missions…</Caption>
      ) : missions.isError ? (
        <Card>
          <Body>Kunde inte hämta missions. Kontrollera anslutningen och dra nedåt för att uppdatera.</Body>
        </Card>
      ) : list.length === 0 ? (
        <EmptyState
          title="Inga missions ännu"
          body="Starta en session i Freevobe Desktop, eller öppna chatten här och beskriv vad du vill bygga."
          action={<Caption>Allt du gör hamnar på datorn – inte i molnet.</Caption>}
        />
      ) : (
        <>
          {needsYou.length > 0 ? (
            <View style={{ gap: spacing.md }}>
              <SectionTitle
                title="Väntar på dig"
                action={<Caption>{needsYou.length}</Caption>}
              />
              {needsYou.map((mission) => (
                <MissionCard
                  key={mission.id}
                  mission={mission}
                  onPress={() => router.push({ pathname: '/mission/[id]', params: { id: mission.id } })}
                />
              ))}
            </View>
          ) : null}

          {active.length > 0 ? (
            <View style={{ gap: spacing.md }}>
              <SectionTitle title="Kör nu" action={<Caption>{active.length}</Caption>} />
              {active.map((mission) => (
                <MissionCard
                  key={mission.id}
                  mission={mission}
                  onPress={() => router.push({ pathname: '/mission/[id]', params: { id: mission.id } })}
                />
              ))}
            </View>
          ) : null}

          {rest.length > 0 ? (
            <View style={{ gap: spacing.md }}>
              <SectionTitle title="Tidigare" />
              {rest.map((mission) => (
                <MissionCard
                  key={mission.id}
                  mission={mission}
                  onPress={() => router.push({ pathname: '/mission/[id]', params: { id: mission.id } })}
                />
              ))}
            </View>
          ) : null}
        </>
      )}
    </Screen>
  );
}
