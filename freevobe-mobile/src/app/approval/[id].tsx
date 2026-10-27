import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { radius, spacing, terminalSurface } from '@/constants/theme';
import { useApprovals, useResolveApproval } from '@/hooks/use-api';
import { APPROVAL_KIND_LABELS, RISK_LABELS, isDestructive, requiresIndividualApproval } from '@/lib/approvals';
import { formatRelativeTime } from '@/lib/format';
import { useTheme } from '@/lib/theme';
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
 * Ett enskilt godkännande. Allt som behövs för att fatta beslut finns på samma skärm: exakt vad som
 * händer, varför det kräver ett godkännande, risknivån och – för filändringar – hela diffen.
 *
 * Destruktiva ändringar kräver en extra bekräftelse. Det är avsiktligt trögt: ett borttaget
 * träd i en ficka är svårare att ångra än ett tryck mindre.
 */
export default function ApprovalDetail() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ id: string }>();
  const approvals = useApprovals(true);
  const resolve = useResolveApproval();
  const [busy, setBusy] = useState<'approved' | 'rejected' | null>(null);

  const approval = approvals.data?.find((candidate) => candidate.id === params.id);

  if (approvals.isLoading) {
    return (
      <Screen>
        <Caption>Hämtar…</Caption>
      </Screen>
    );
  }

  if (!approval) {
    return (
      <Screen>
        <EmptyState
          title="Godkännandet är redan besvarat"
          body="Det har godkänts, avböjts eller dragits tillbaka i Freevobe Desktop."
          action={<Button label="Tillbaka" variant="secondary" onPress={() => router.back()} />}
        />
      </Screen>
    );
  }

  const individual = requiresIndividualApproval(approval);
  const destructive = isDestructive(approval);

  const answer = (decision: 'approved' | 'rejected') => {
    const run = () => {
      setBusy(decision);
      resolve.mutate(
        { approvalId: approval.id, decision },
        {
          onSettled: () => {
            setBusy(null);
            router.back();
          },
        },
      );
    };

    if (decision === 'approved' && destructive) {
      Alert.alert(
        'Godkänn en destruktiv ändring?',
        `${approval.title}\n\n${approval.detail}`,
        [
          { text: 'Avbryt', style: 'cancel' },
          { text: 'Godkänn', style: 'destructive', onPress: run },
        ],
      );
      return;
    }
    run();
  };

  return (
    <Screen contentStyle={{ paddingBottom: spacing.xxxl }}>
      <View style={styles.rowBetween}>
        <Chip label="← Tillbaka" onPress={() => router.back()} />
        <Chip label={formatRelativeTime(approval.createdAt)} />
      </View>

      <View style={{ gap: spacing.sm }}>
        <View style={styles.row}>
          <Chip label={APPROVAL_KIND_LABELS[approval.kind]} tone="accent" />
          <Chip
            label={RISK_LABELS[approval.risk]}
            tone={approval.risk === 'low' ? 'success' : approval.risk === 'medium' ? 'warn' : 'danger'}
          />
          {approval.hardBlock ? <Chip label="Destruktiv" tone="danger" /> : null}
        </View>
        <Title>{approval.title}</Title>
        <Body muted>{approval.detail}</Body>
      </View>

      {destructive ? (
        <Card tone="accent">
          <View style={styles.row}>
            <StatusDot color="diffRemove" />
            <Heading>Särskilt godkännande krävs</Heading>
          </View>
          <Body>
            {individual
              ? 'Det här steget kan inte godkännas tillsammans med andra. Läs igenom och svara för sig.'
              : 'Läs igenom innan du svarar.'}
          </Body>
        </Card>
      ) : null}

      <View
        style={{
          backgroundColor: terminalSurface.background,
          borderColor: terminalSurface.border,
          borderWidth: 1,
          borderRadius: radius.lg,
          padding: spacing.md,
          gap: spacing.xs,
        }}
      >
        <Caption muted={false}>
          {approval.command ? 'Exakt kommando' : approval.path ? 'Fil' : 'Detalj'}
        </Caption>
        <Mono style={{ color: theme.terminal }}>
          {approval.command
            ? [approval.command, ...(approval.args ?? [])].join(' ')
            : (approval.path ?? approval.url ?? approval.detail)}
        </Mono>
        {approval.cwd ? <Caption>Arbetskatalog: {approval.cwd}</Caption> : null}
      </View>

      {approval.diff ? (
        <View style={{ gap: spacing.md }}>
          <SectionTitle title="Diff" />
          <DiffView diff={approval.diff} maxPages={5} />
        </View>
      ) : null}

      <Card>
        <Heading>Varför krävs ett godkännande?</Heading>
        <Body muted>{approval.reason || 'Projektets behörighetsläge kräver ett svar för det här steget.'}</Body>
        <KeyValue label="Körning" value={approval.runId} />
        <KeyValue label="Typ" value={approval.kind} />
        <KeyValue label="Risk" value={approval.risk} />
      </Card>

      <View style={{ gap: spacing.md }}>
        <Button
          label="Approve"
          busy={busy === 'approved'}
          disabled={busy !== null}
          onPress={() => answer('approved')}
        />
        <Button
          label="Reject"
          variant="danger"
          busy={busy === 'rejected'}
          disabled={busy !== null}
          onPress={() => answer('rejected')}
        />
        <Caption>
          Godkänner du skriver agenten filen eller kör kommandot på datorn. Avböjer du stoppas steget
          och agenten får svar att den inte fick fortsätta.
        </Caption>
      </View>
    </Screen>
  );
}
