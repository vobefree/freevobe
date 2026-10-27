import { Pressable, View } from 'react-native';
import type {
  ApprovalRequest,
  ConnectionStatus,
  DesktopSnapshot,
  Mission,
  TerminalEntry,
} from '@/api/types';
import { mono, radius, spacing, terminalSurface, typography } from '@/constants/theme';
import { APPROVAL_KIND_LABELS, RISK_LABELS, approvalSummary, requiresIndividualApproval } from '@/lib/approvals';
import { formatRelativeTime } from '@/lib/format';
import { useTheme } from '@/lib/theme';
import { Body, Caption, Card, Chip, Heading, Mono, StatusDot, Title, styles } from './ui';

/** Status för anslutningen till datorn: namn, modell, aktiva körningar och väntande godkännanden. */
export function StatusCard({
  status,
  snapshot,
  demo,
  error,
  onConnect,
  onDisconnect,
}: {
  status: ConnectionStatus;
  snapshot?: DesktopSnapshot;
  demo: boolean;
  error?: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  const connected = demo || status === 'connected';
  const dotColor = demo ? 'accent' : connected ? 'teal' : status === 'connecting' ? 'warn' : 'diffRemove';

  return (
    <Card tone={connected ? 'default' : 'accent'}>
      <View style={styles.rowBetween}>
        <View style={[styles.row, { flexShrink: 1 }]}>
          <StatusDot color={dotColor} />
          <Title>{demo ? 'Demoläge' : (snapshot?.health.name ?? 'Ingen dator vald')}</Title>
        </View>
        <Chip
          label={demo ? 'Demo' : connected ? 'Ansluten' : status === 'connecting' ? 'Ansluter' : 'Frånkopplad'}
          tone={connected ? 'teal' : status === 'connecting' ? 'warn' : 'danger'}
        />
      </View>

      {demo ? (
        <Body muted>
          Appen visar påhittad data. Koppla upp mot Freevobe Desktop för att styra din riktiga dator.
        </Body>
      ) : connected && snapshot ? (
        <View style={{ gap: spacing.xs }}>
          <View style={styles.row}>
            <Caption>Modell</Caption>
            <Mono>{snapshot.activeModel ?? 'ingen vald'}</Mono>
          </View>
          <View style={styles.row}>
            <Caption>Aktiva körningar</Caption>
            <Body>{snapshot.activeSessions}</Body>
          </View>
          <View style={styles.row}>
            <Caption>Väntande godkännanden</Caption>
            <Body>{snapshot.pendingApprovals}</Body>
          </View>
        </View>
      ) : (
        <Body muted>
          {error ??
            'Anslut till Freevobe Desktop på din dator. Både telefonen och datorn måste vara på samma nätverk.'}
        </Body>
      )}

      <View style={[styles.row, { marginTop: spacing.sm }]}>
        {connected && !demo ? (
          <Chip label="Koppla bort" tone="danger" onPress={onDisconnect} />
        ) : (
          <Chip label="Anslut till Desktop" tone="accent" onPress={onConnect} />
        )}
      </View>
    </Card>
  );
}

const STATUS_TONES: Record<Mission['status'], { label: string; tone: 'accent' | 'teal' | 'warn' | 'danger' | 'neutral' | 'success' }> = {
  running: { label: 'Kör', tone: 'teal' },
  'waiting-approval': { label: 'Väntar på dig', tone: 'warn' },
  done: { label: 'Klar', tone: 'success' },
  failed: { label: 'Fel', tone: 'danger' },
  aborted: { label: 'Avbruten', tone: 'neutral' },
  idle: { label: 'Vilande', tone: 'neutral' },
};

/** En mission i listan: titel, status, fas, steg och berörda filer. */
export function MissionCard({ mission, onPress }: { mission: Mission; onPress: () => void }) {
  const theme = useTheme();
  const done = mission.steps.filter((step) => step.status === 'done').length;
  const tone = STATUS_TONES[mission.status];
  const activeStep = mission.steps.find((step) => step.status === 'active');

  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
      <Card>
        <View style={styles.rowBetween}>
          <Heading style={{ flexShrink: 1 }}>{mission.title}</Heading>
          <Chip label={tone.label} tone={tone.tone} />
        </View>

        <View style={[styles.row, { flexWrap: 'wrap' }]}>
          <Caption>
            {mission.steps.length > 0 ? `${done}/${mission.steps.length} steg` : 'Inga steg ännu'}
          </Caption>
          {activeStep ? <Caption>· {activeStep.title}</Caption> : null}
          <Caption>· {formatRelativeTime(mission.updatedAt)}</Caption>
        </View>

        {mission.files.length > 0 ? (
          <View style={{ gap: 2 }}>
            {mission.files.slice(0, 3).map((file) => (
              <View key={file.path} style={styles.row}>
                <Caption>
                  {file.kind === 'create' ? 'Ny' : file.kind === 'delete' ? 'Bort' : 'Ändrad'}
                </Caption>
                <Mono style={{ flexShrink: 1 }}>{file.path}</Mono>
              </View>
            ))}
          </View>
        ) : null}

        {mission.needsApproval ? (
          <View style={[styles.row, { marginTop: spacing.xs }]}>
            <StatusDot color="warn" />
            <Body style={{ color: theme.warn }}>Väntar på ett godkännande från dig</Body>
          </View>
        ) : null}
      </Card>
    </Pressable>
  );
}

export const RISK_TONES: Record<ApprovalRequest['risk'], 'success' | 'warn' | 'danger'> = {
  low: 'success',
  medium: 'warn',
  high: 'danger',
};

/** Ett godkännande: vad som händer, hur riskabelt det är och vad det gäller. */
export function ApprovalCard({
  approval,
  onPress,
  onApprove,
  onReject,
  busy = false,
  compact = false,
}: {
  approval: ApprovalRequest;
  onPress?: () => void;
  onApprove?: () => void;
  onReject?: () => void;
  busy?: boolean;
  compact?: boolean;
}) {
  const theme = useTheme();
  const individual = requiresIndividualApproval(approval);

  return (
    <Card tone={approval.hardBlock ? 'accent' : 'default'}>
      <View style={styles.rowBetween}>
        <View style={[styles.row, { flexShrink: 1 }]}>
          <Chip label={APPROVAL_KIND_LABELS[approval.kind]} tone="accent" />
          <Chip label={RISK_LABELS[approval.risk]} tone={RISK_TONES[approval.risk]} />
        </View>
        <Caption>{formatRelativeTime(approval.createdAt)}</Caption>
      </View>

      <Heading>{approval.title}</Heading>
      {!compact ? <Body muted>{approval.detail}</Body> : null}

      <View
        style={{
          backgroundColor: terminalSurface.background,
          borderColor: terminalSurface.border,
          borderWidth: 1,
          borderRadius: radius.md,
          padding: spacing.md,
        }}
      >
        <Mono>{approvalSummary(approval)}</Mono>
      </View>

      {approval.reason ? <Caption>Godkännande krävs: {approval.reason}</Caption> : null}
      {approval.hardBlock ? (
        <View style={styles.row}>
          <StatusDot color="diffRemove" />
          <Body style={{ color: theme.diffRemove }}>
            Destruktiv ändring – den kan inte godkännas i grupp.
          </Body>
        </View>
      ) : null}

      {onApprove || onReject ? (
        <View style={[styles.row, { marginTop: spacing.sm }]}>
          {onApprove ? (
            <View style={{ flex: 1 }}>
              <Chip
                label={busy ? 'Skickar…' : 'Approve'}
                tone={individual ? 'warn' : 'success'}
                onPress={busy ? undefined : onApprove}
              />
            </View>
          ) : null}
          {onReject ? (
            <View style={{ flex: 1 }}>
              <Chip label="Reject" tone="danger" onPress={busy ? undefined : onReject} />
            </View>
          ) : null}
        </View>
      ) : null}

      {/*
       * “View details” är en egen knapp i stället för att hela kortet är tryckbart: kortet innehåller
       * redan knappar, och en knapp inuti en knapp är både ogiltig HTML på webben och en otydlig
       * träffyta på telefonen.
       */}
      {onPress ? (
        <View style={{ marginTop: spacing.xs }}>
          <Chip label="View details" tone="accent" onPress={onPress} />
        </View>
      ) : null}
    </Card>
  );
}

const LOG_COLORS: Record<TerminalEntry['kind'], 'fg' | 'terminal' | 'diffRemove' | 'muted' | 'accentSoft'> = {
  command: 'accentSoft',
  stdout: 'terminal',
  stderr: 'diffRemove',
  system: 'muted',
  test: 'fg',
};

/** Terminal- och testutdata i läsbar form. Tryck för att kopiera hela raden. */
export function LogList({
  entries,
  onCopy,
}: {
  entries: TerminalEntry[];
  onCopy?: (entry: TerminalEntry) => void;
}) {
  const theme = useTheme();

  return (
    <View
      style={{
        backgroundColor: terminalSurface.background,
        borderColor: terminalSurface.border,
        borderWidth: 1,
        borderRadius: radius.lg,
        padding: spacing.md,
        gap: spacing.sm,
      }}
    >
      {entries.map((entry) => (
        <Pressable
          key={entry.id}
          onPress={onCopy ? () => onCopy(entry) : undefined}
          accessibilityRole={onCopy ? 'button' : undefined}
          accessibilityLabel={onCopy ? 'Kopiera loggrader' : undefined}
        >
          <View style={{ gap: 2 }}>
            <View style={styles.row}>
              <Caption>{entry.kind === 'command' ? 'kommando' : entry.kind}</Caption>
              {typeof entry.exitCode === 'number' ? (
                <Chip
                  label={`exit ${entry.exitCode}`}
                  tone={entry.exitCode === 0 ? 'success' : 'danger'}
                />
              ) : null}
            </View>
            {entry.command ? (
              <Mono style={{ color: theme.accentSoft }}>$ {entry.command}</Mono>
            ) : null}
            <Mono
              style={{
                color: theme[LOG_COLORS[entry.kind]] as string,
                fontFamily: mono,
                fontSize: 12,
                lineHeight: 18,
              }}
            >
              {entry.text.trimEnd() || '(tom utdata)'}
            </Mono>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

/** Steglistan för en mission. */
export function StepList({ steps }: { steps: Mission['steps'] }) {
  const theme = useTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      {steps.map((step) => {
        const color =
          step.status === 'done'
            ? theme.diffAdd
            : step.status === 'active'
              ? theme.accent
              : step.status === 'failed'
                ? theme.diffRemove
                : theme.borderStrong;
        return (
          <View key={step.id} style={styles.row}>
            <View
              style={{
                width: 18,
                height: 18,
                borderRadius: radius.pill,
                borderWidth: 2,
                borderColor: color,
                backgroundColor: step.status === 'done' ? color : 'transparent',
              }}
            />
            <Body
              style={{
                flexShrink: 1,
                color: step.status === 'pending' ? theme.muted : theme.fg,
                ...typography.body,
              }}
            >
              {step.title}
            </Body>
          </View>
        );
      })}
    </View>
  );
}
