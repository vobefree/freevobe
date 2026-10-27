import { router, useLocalSearchParams } from 'expo-router';
import { RefreshControl, View } from 'react-native';
import { spacing } from '@/constants/theme';
import { useMission } from '@/hooks/use-api';
import { formatRelativeTime } from '@/lib/format';
import { useTheme } from '@/lib/theme';
import { useActiveSession } from '@/state/session';
import { ApprovalCard, StepList } from '@/components/cards';
import { DiffView } from '@/components/diff-view';
import {
  Body,
  Button,
  Caption,
  Card,
  Chip,
  EmptyState,
  Heading,
  KeyValue,
  Mono,
  Screen,
  SectionTitle,
  StatusDot,
  Title,
  styles,
} from '@/components/ui';

/**
 * En mission i detalj: plan, berörda filer, diff, tester och det som väntar på ett godkännande.
 * Härifrån kan användaren hoppa in i chatten för samma session.
 */
export default function MissionDetail() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ id: string }>();
  const mission = useMission(params.id);
  const select = useActiveSession((state) => state.select);

  const data = mission.data;

  if (mission.isLoading) {
    return (
      <Screen>
        <Caption>Hämtar missionen…</Caption>
      </Screen>
    );
  }

  if (!data) {
    return (
      <Screen>
        <EmptyState
          title="Missionen finns inte"
          body="Den kan ha tagits bort i Freevobe Desktop, eller så tappade appen kontakten med datorn."
          action={<Button label="Tillbaka" variant="secondary" onPress={() => router.back()} />}
        />
      </Screen>
    );
  }

  const done = data.steps.filter((step) => step.status === 'done').length;

  return (
    <Screen
      contentStyle={{ paddingBottom: spacing.xxxl }}
      refreshControl={
        <RefreshControl
          refreshing={mission.isFetching}
          onRefresh={() => void mission.refetch()}
          tintColor={theme.accent}
        />
      }
    >
      <View style={styles.rowBetween}>
        <Chip label="← Tillbaka" onPress={() => router.back()} />
        <Chip
          label={
            data.status === 'waiting-approval'
              ? 'Väntar på dig'
              : data.status === 'running'
                ? 'Kör'
                : data.status === 'failed'
                  ? 'Fel'
                  : 'Vilande'
          }
          tone={
            data.status === 'waiting-approval'
              ? 'warn'
              : data.status === 'running'
                ? 'teal'
                : data.status === 'failed'
                  ? 'danger'
                  : 'neutral'
          }
        />
      </View>

      <View style={{ gap: spacing.xs }}>
        <Title>{data.title}</Title>
        <Caption>
          {data.model ?? 'okänd modell'} · uppdaterad {formatRelativeTime(data.updatedAt)}
        </Caption>
      </View>

      <View style={styles.row}>
        <Button
          label="Öppna chatten"
          onPress={() => {
            select(data.id);
            router.push('/(tabs)/chat');
          }}
        />
        <Button label="Loggar" variant="secondary" onPress={() => router.push('/(tabs)/logs')} />
      </View>

      {data.approvals.length > 0 ? (
        <View style={{ gap: spacing.md }}>
          <SectionTitle title="Väntar på ditt svar" action={<Caption>{data.approvals.length}</Caption>} />
          {data.approvals.map((approval) => (
            <ApprovalCard
              key={approval.id}
              approval={approval}
              onPress={() => router.push({ pathname: '/approval/[id]', params: { id: approval.id } })}
            />
          ))}
        </View>
      ) : null}

      <View style={{ gap: spacing.md }}>
        <SectionTitle
          title="Plan"
          action={<Caption>{data.steps.length > 0 ? `${done}/${data.steps.length}` : '—'}</Caption>}
        />
        <Card>
          {data.steps.length > 0 ? (
            <StepList steps={data.steps} />
          ) : (
            <Body muted>Inga steg är uppskrivna för den här sessionen ännu.</Body>
          )}
        </Card>
      </View>

      <View style={{ gap: spacing.md }}>
        <SectionTitle title="Filer" action={<Caption>{data.files.length}</Caption>} />
        {data.files.length === 0 ? (
          <Card>
            <Body muted>Inga filer är ändrade i projektet ännu.</Body>
          </Card>
        ) : (
          <Card>
            <View style={{ gap: spacing.sm }}>
              {data.files.map((file) => (
                <View key={file.path} style={styles.rowBetween}>
                  <View style={[styles.row, { flexShrink: 1 }]}>
                    <StatusDot color={file.kind === 'delete' ? 'diffRemove' : 'diffAdd'} />
                    <Mono style={{ flexShrink: 1 }}>{file.path}</Mono>
                  </View>
                  <Caption>
                    {file.kind === 'create' ? 'ny' : file.kind === 'delete' ? 'bort' : 'ändrad'}
                    {file.additions || file.deletions ? ` +${file.additions} −${file.deletions}` : ''}
                  </Caption>
                </View>
              ))}
            </View>
          </Card>
        )}
      </View>

      {data.diff ? (
        <View style={{ gap: spacing.md }}>
          <SectionTitle title="Senaste diff" />
          <DiffView diff={data.diff} maxPages={3} />
        </View>
      ) : null}

      {data.tests ? (
        <View style={{ gap: spacing.md }}>
          <SectionTitle title="Tester" />
          <Card tone={data.tests.failed > 0 ? 'accent' : 'default'}>
            <View style={styles.row}>
              <Chip label={`${data.tests.passed} godkända`} tone="success" />
              <Chip
                label={`${data.tests.failed} misslyckade`}
                tone={data.tests.failed > 0 ? 'danger' : 'neutral'}
              />
            </View>
            <Mono>{data.tests.command}</Mono>
            <Mono style={{ color: data.tests.failed > 0 ? theme.diffRemove : theme.terminal }}>
              {data.tests.output.trim() || 'Ingen utdata.'}
            </Mono>
          </Card>
        </View>
      ) : null}

      <View style={{ gap: spacing.md }}>
        <SectionTitle title="Senaste loggrader" />
        {data.logs.length === 0 ? (
          <Card>
            <Body muted>Inga loggrader ännu.</Body>
          </Card>
        ) : (
          <Card>
            <View style={{ gap: spacing.xs }}>
              {data.logs.slice(-4).map((entry) => (
                <Mono key={entry.id}>
                  {entry.kind === 'command' ? '$ ' : ''}
                  {entry.text.trim().split('\n')[0] || '(tomt)'}
                </Mono>
              ))}
            </View>
          </Card>
        )}
      </View>

      <Card>
        <Heading>Tekniskt</Heading>
        <KeyValue label="Session" value={data.id} />
        <KeyValue label="Projekt" value={data.projectId} />
        <KeyValue label="Fas" value={data.phase} />
        <KeyValue label="Modell" value={data.model ?? '—'} />
      </Card>
    </Screen>
  );
}
