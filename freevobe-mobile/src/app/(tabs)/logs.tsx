import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { spacing } from '@/constants/theme';
import { useLogs, useMissions } from '@/hooks/use-api';
import { formatClock } from '@/lib/format';
import { useTheme } from '@/lib/theme';
import { useActiveSession } from '@/state/session';
import { LogList } from '@/components/cards';
import { Body, Caption, Card, Chip, EmptyState, Mono, Screen, SectionTitle, styles } from '@/components/ui';

/**
 * Loggar: senaste terminalkommandon, utdata och testresultat. Allt kan kopieras – det är ofta det
 * man vill göra med en fellogg.
 *
 * Att *köra* kommandon härifrån är medvetet inte möjligt i v1: telefonen är ett fönster in i det som
 * händer på datorn, inte ännu ett skal.
 */
export default function LogsScreen() {
  const theme = useTheme();
  const activeSessionId = useActiveSession((state) => state.activeSessionId);
  const select = useActiveSession((state) => state.select);
  const missions = useMissions(true);

  useEffect(() => {
    if (activeSessionId || !missions.data?.length) return;
    select(missions.data[0]?.id ?? null);
  }, [activeSessionId, missions.data, select]);

  const logs = useLogs(activeSessionId ?? undefined);
  const [copied, setCopied] = useState<string | null>(null);

  const entries = logs.data ?? [];
  const failures = entries.filter((entry) => entry.kind === 'stderr' || (entry.exitCode ?? 0) !== 0);
  const activeMission = missions.data?.find((mission) => mission.id === activeSessionId);

  return (
    <Screen
      contentStyle={{ paddingBottom: spacing.xxxl }}
      refreshControl={
        <RefreshControl
          refreshing={logs.isFetching}
          onRefresh={() => void logs.refetch()}
          tintColor={theme.accent}
        />
      }
    >
      <View>
        <Caption muted={false}>Logs</Caption>
        <Body muted>Terminal, utdata och tester från datorn.</Body>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {(missions.data ?? []).slice(0, 6).map((mission) => (
          <Chip
            key={mission.id}
            label={mission.title.length > 22 ? `${mission.title.slice(0, 22)}…` : mission.title}
            selected={mission.id === activeSessionId}
            onPress={() => select(mission.id)}
          />
        ))}
      </View>

      {failures.length > 0 ? (
        <Card tone="accent">
          <SectionTitle title="Misslyckade tester" />
          <View style={{ gap: spacing.xs }}>
            {failures.slice(-3).map((entry) => (
              <Mono key={entry.id} style={{ color: theme.diffRemove }}>
                {entry.text.trim().split('\n')[0] || entry.command || 'fel'}
              </Mono>
            ))}
          </View>
        </Card>
      ) : null}

      {entries.length === 0 ? (
        <EmptyState
          title="Inga loggrader ännu"
          body={
            activeMission
              ? 'Så snart agenten kör ett kommando på datorn hamnar utdata här.'
              : 'Välj en mission ovan för att se dess loggar.'
          }
        />
      ) : (
        <LogList
          entries={entries}
          onCopy={async (entry) => {
            await Clipboard.setStringAsync(entry.command ? `$ ${entry.command}\n${entry.text}` : entry.text);
            setCopied(entry.id);
          }}
        />
      )}

      {copied ? (
        <View style={styles.row}>
          <Chip label="Kopierat" tone="success" />
          <Caption>Loggraden ligger i urklipp.</Caption>
        </View>
      ) : null}

      <View style={{ gap: spacing.xs }}>
        <Caption muted={false}>Om senaste körningen</Caption>
        <Mono>
          {activeMission
            ? `${activeMission.title} · ${activeMission.status} · ${formatClock(activeMission.updatedAt)}`
            : 'Ingen mission vald.'}
        </Mono>
      </View>
    </Screen>
  );
}
