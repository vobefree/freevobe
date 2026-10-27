import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { radius, spacing, touchTarget, typography } from '@/constants/theme';
import { useAbortRun, useMission, useMissions, useResolveApproval, useSendPrompt } from '@/hooks/use-api';
import { useRunStream } from '@/hooks/use-run-stream';
import { formatClock } from '@/lib/format';
import { useTheme } from '@/lib/theme';
import { selectRun, useRuns } from '@/state/run';
import { useActiveSession } from '@/state/session';
import { ApprovalCard } from '@/components/cards';
import {
  Body,
  Button,
  Caption,
  Card,
  Chip,
  EmptyState,
  Heading,
  Mono,
  SectionTitle,
  screenTopPadding,
  styles,
} from '@/components/ui';
import { DiffView } from '@/components/diff-view';

/**
 * Chatten. Historiken kommer från datorn; det som händer just nu byggs upp av händelseströmmen.
 * Väntar agenten på ett godkännande visas det direkt i flödet, så att användaren kan svara utan att
 * byta flik.
 */
export default function ChatScreen() {
  const theme = useTheme();
  const activeSessionId = useActiveSession((state) => state.activeSessionId);
  const select = useActiveSession((state) => state.select);
  const runs = useRuns((state) => state.runs);
  const begin = useRuns((state) => state.begin);
  const setPendingApproval = useRuns((state) => state.setPendingApproval);

  const missions = useMissions(true);
  const [runId, setRunId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);

  // Utan vald mission: ta den senaste, så att fliken aldrig är tom i onödan.
  useEffect(() => {
    if (activeSessionId || !missions.data?.length) return;
    select(missions.data[0]?.id ?? null);
  }, [activeSessionId, missions.data, select]);

  const mission = useMission(activeSessionId ?? undefined);
  const run = selectRun(runs, activeSessionId ?? '');
  const sendPrompt = useSendPrompt();
  const abortRun = useAbortRun();
  const resolveApproval = useResolveApproval();

  useRunStream(activeSessionId ?? undefined, runId);

  // Håll godkännandet i körningsvyn i synk med det som datorn rapporterar.
  useEffect(() => {
    if (!activeSessionId || !mission.data) return;
    setPendingApproval(activeSessionId, mission.data.approvals[0] ?? null);
  }, [activeSessionId, mission.data, setPendingApproval]);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
  }, [run.messages.length, run.streamingText, mission.data?.messages.length]);

  if (!activeSessionId) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={['top']}>
        <View style={{ padding: spacing.lg }}>
          <EmptyState
            title="Ingen mission vald"
            body="Välj en mission under fliken Missions, eller starta en ny i Freevobe Desktop. Sedan kan du skriva härifrån."
          />
        </View>
      </SafeAreaView>
    );
  }

  const messages = [...(mission.data?.messages ?? []), ...run.messages];
  const canSend = prompt.trim().length > 0 && !sendPrompt.isPending;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={{
            padding: spacing.lg,
            paddingTop: screenTopPadding,
            gap: spacing.md,
            paddingBottom: spacing.xl,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.rowBetween}>
            <View style={{ flexShrink: 1, gap: 2 }}>
              <Heading style={{ flexShrink: 1 }}>{mission.data?.title ?? 'Session'}</Heading>
              <Caption>
                {run.running ? `Kör · ${run.phase}` : mission.data?.model ?? ''}
                {run.summary ? ` · ${run.summary}` : ''}
              </Caption>
            </View>
            {run.running && run.runId ? (
              <Chip label="Avbryt" tone="danger" onPress={() => void abortRun.mutateAsync(run.runId as string)} />
            ) : null}
          </View>

          {run.error ? (
            <Card tone="accent">
              <Body>{run.error}</Body>
            </Card>
          ) : null}

          {run.pendingApproval ? (
            <View style={{ gap: spacing.sm }}>
              <SectionTitle title="Väntar på ditt svar" />
              <ApprovalCard
                approval={run.pendingApproval}
                compact
                busy={resolveApproval.isPending}
                onApprove={() =>
                  resolveApproval.mutate({
                    approvalId: run.pendingApproval?.id ?? '',
                    decision: 'approved',
                  })
                }
                onReject={() =>
                  resolveApproval.mutate({
                    approvalId: run.pendingApproval?.id ?? '',
                    decision: 'rejected',
                  })
                }
              />
            </View>
          ) : null}

          {messages.map((message) => (
            <View
              key={message.id}
              style={{
                alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '92%',
                gap: spacing.xs,
              }}
            >
              <View
                style={{
                  backgroundColor: message.role === 'user' ? theme.accent : theme.card,
                  borderColor: message.role === 'user' ? theme.accent : theme.border,
                  borderWidth: 1,
                  borderRadius: radius.lg,
                  padding: spacing.md,
                }}
              >
                <Body style={{ color: message.role === 'user' ? theme.onAccent : theme.fg }}>
                  {message.text}
                </Body>
              </View>
              {message.toolCalls?.length ? (
                <View style={{ gap: spacing.xs }}>
                  {message.toolCalls.map((call) => (
                    <View key={call.id} style={styles.row}>
                      <Chip
                        label={call.status === 'running' ? 'kör' : call.status === 'ok' ? 'ok' : 'fel'}
                        tone={call.status === 'running' ? 'accent' : call.status === 'ok' ? 'success' : 'danger'}
                      />
                      <Mono>{call.summary}</Mono>
                    </View>
                  ))}
                </View>
              ) : null}
              <Caption>{formatClock(message.createdAt)}</Caption>
            </View>
          ))}

          {run.streamingText ? (
            <View style={{ alignSelf: 'flex-start', maxWidth: '92%' }}>
              <Card tone="accent">
                <Body>{run.streamingText}</Body>
              </Card>
            </View>
          ) : null}

          {run.steps.length > 0 ? (
            <View style={{ gap: spacing.xs }}>
              <Caption muted={false}>Plan</Caption>
              {run.steps.map((step) => (
                <View key={step.id} style={styles.row}>
                  <Chip
                    label={step.status === 'done' ? '✓' : step.status === 'active' ? '→' : step.status === 'failed' ? '✕' : '·'}
                    tone={
                      step.status === 'done'
                        ? 'success'
                        : step.status === 'active'
                          ? 'accent'
                          : step.status === 'failed'
                            ? 'danger'
                            : 'neutral'
                    }
                  />
                  <Body muted={step.status === 'pending'} style={{ flexShrink: 1 }}>
                    {step.title}
                  </Body>
                </View>
              ))}
            </View>
          ) : null}

          {run.diff ? <DiffView diff={run.diff} maxPages={2} /> : null}

          {run.tests ? (
            <Card tone={run.tests.failed > 0 ? 'accent' : 'default'}>
              <Heading>Tester</Heading>
              <View style={styles.row}>
                <Chip label={`${run.tests.passed} godkända`} tone="success" />
                <Chip
                  label={`${run.tests.failed} misslyckade`}
                  tone={run.tests.failed > 0 ? 'danger' : 'neutral'}
                />
              </View>
              <Mono>{run.tests.command}</Mono>
            </Card>
          ) : null}
        </ScrollView>

        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: theme.border,
            padding: spacing.md,
            gap: spacing.sm,
            backgroundColor: theme.bgSoft,
          }}
        >
          <View style={styles.row}>
            <TextInput
              value={prompt}
              onChangeText={setPrompt}
              placeholder="Beskriv vad agenten ska göra…"
              placeholderTextColor={theme.muted}
              multiline
              accessibilityLabel="Prompt"
              style={{
                flex: 1,
                minHeight: touchTarget,
                maxHeight: 120,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: theme.border,
                backgroundColor: theme.card,
                color: theme.fg,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                ...typography.body,
              }}
            />
            <Button
              label="Skicka"
              disabled={!canSend}
              busy={sendPrompt.isPending}
              onPress={async () => {
                const text = prompt.trim();
                if (!text || !activeSessionId) return;
                setPrompt('');
                const result = await sendPrompt.mutateAsync({ sessionId: activeSessionId, prompt: text });
                begin(activeSessionId, result.runId);
                setRunId(result.runId);
              }}
            />
          </View>
          <Caption>
            Ändringar och kommandon körs på datorn och kräver ditt godkännande där policyn säger det.
          </Caption>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
