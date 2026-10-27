import { router } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { spacing } from '@/constants/theme';
import { useApprovals, useResolveApproval } from '@/hooks/use-api';
import { useApprovalWatcher } from '@/hooks/use-run-stream';
import { splitApprovals } from '@/lib/approvals';
import { useTheme } from '@/lib/theme';
import { ApprovalCard } from '@/components/cards';
import { Body, Caption, Card, EmptyState, Screen, SectionTitle, StatusDot } from '@/components/ui';

/**
 * Godkännanden. Enkla ändringar kan godkännas i grupp, men destruktiva ändringar (filborttagning,
 * hög risk eller ett hårt blockerat steg) ligger alltid för sig med en tydlig varning – kravet är att
 * de aldrig får godkännas av misstag tillsammans med något annat.
 */
export default function ApprovalsScreen() {
  const theme = useTheme();
  const approvals = useApprovals(true);
  const resolve = useResolveApproval();
  const [busyId, setBusyId] = useState<string | null>(null);

  useApprovalWatcher(approvals.data, false);

  const { batchable, individual } = splitApprovals(approvals.data ?? []);

  return (
    <Screen
      contentStyle={{ paddingBottom: spacing.xxxl }}
      refreshControl={
        <RefreshControl
          refreshing={approvals.isFetching}
          onRefresh={() => void approvals.refetch()}
          tintColor={theme.accent}
        />
      }
    >
      <View>
        <Caption muted={false}>Approvals</Caption>
        <Body muted>Inget körs på datorn förrän du säger ja här.</Body>
      </View>

      {approvals.isLoading ? <Caption>Hämtar…</Caption> : null}

      {approvals.data && approvals.data.length === 0 ? (
        <EmptyState
          title="Inget väntar"
          body="När agenten behöver ett godkännande dyker det upp här – och som en notis på telefonen."
        />
      ) : null}

      {individual.length > 0 ? (
        <View style={{ gap: spacing.md }}>
          <SectionTitle title="Kräver ditt eget svar" action={<Caption>{individual.length}</Caption>} />
          {individual.map((approval) => (
            <View key={approval.id} style={{ gap: spacing.sm }}>
              <ApprovalCard
                approval={approval}
                busy={busyId === approval.id}
                onPress={() => router.push({ pathname: '/approval/[id]', params: { id: approval.id } })}
                onApprove={() => {
                  setBusyId(approval.id);
                  resolve.mutate(
                    { approvalId: approval.id, decision: 'approved' },
                    { onSettled: () => setBusyId(null) },
                  );
                }}
                onReject={() => {
                  setBusyId(approval.id);
                  resolve.mutate(
                    { approvalId: approval.id, decision: 'rejected' },
                    { onSettled: () => setBusyId(null) },
                  );
                }}
              />
            </View>
          ))}
        </View>
      ) : null}

      {batchable.length > 0 ? (
        <View style={{ gap: spacing.md }}>
          <SectionTitle
            title="Enkla ändringar"
            action={<Caption>{`${batchable.length} väntar`}</Caption>}
          />

          <Card tone="default">
            <View style={{ gap: spacing.xs }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <StatusDot color="teal" />
                <Body muted>
                  Dessa är låg- eller medelrisk och kan godkännas tillsammans. Diffen finns kvar under
                  varje ärende om du vill läsa först.
                </Body>
              </View>
            </View>
          </Card>

          {batchable.map((approval) => (
            <ApprovalCard
              key={approval.id}
              approval={approval}
              busy={busyId === approval.id}
              onPress={() => router.push({ pathname: '/approval/[id]', params: { id: approval.id } })}
              onApprove={() => {
                setBusyId(approval.id);
                resolve.mutate(
                  { approvalId: approval.id, decision: 'approved' },
                  { onSettled: () => setBusyId(null) },
                );
              }}
              onReject={() => {
                setBusyId(approval.id);
                resolve.mutate(
                  { approvalId: approval.id, decision: 'rejected' },
                  { onSettled: () => setBusyId(null) },
                );
              }}
            />
          ))}
        </View>
      ) : null}

      <Caption>
        Att köra egna kommandon från telefonen är avstängt i v1. Här svarar du bara på det agenten
        redan föreslagit.
      </Caption>
    </Screen>
  );
}
