import * as Clipboard from 'expo-clipboard';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createHttpApi } from '@/api/http';
import { ApiError } from '@/api/client';
import { radius, spacing, terminalSurface } from '@/constants/theme';
import { newId } from '@/lib/format';
import { assessEndpointSecurity, PairingError, normalizeHostUrl, parsePairingPayload } from '@/lib/pairing';
import { useTheme } from '@/lib/theme';
import { useConnection } from '@/state/connection';
import { useSettings } from '@/state/settings';
import { Body, Button, Card, Caption, Chip, Field, Heading, Mono, StatusDot, Title, styles } from '@/components/ui';

/**
 * Parning. Fyra steg i ett och samma flöde: läs av (QR, urklipp eller handskrivet), bedöm
 * säkerheten, verifiera mot datorn och spara.
 *
 * Verifieringen sker *innan* något sparas – en felstavad adress eller en gammal kod ska ge ett tydligt
 * besked här, inte ett tyst fel i första bästa vy.
 */

type Mode = 'scan' | 'manual';
type Feedback = { tone: 'success' | 'warn' | 'danger'; message: string } | null;

export default function Connect() {
  const theme = useTheme();
  const addDesktop = useConnection((state) => state.addDesktop);
  const selectProject = useConnection((state) => state.selectProject);
  const setDemoMode = useSettings((state) => state.setDemoMode);

  const [mode, setMode] = useState<Mode>(Platform.OS === 'web' ? 'manual' : 'scan');
  const [label, setLabel] = useState('Min dator');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('4319');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  /** Bedömer adressen utan att spara något, så att varningen syns medan man skriver. */
  const assessment = (() => {
    try {
      return assessEndpointSecurity(normalizeHostUrl({ host, port }));
    } catch {
      return null;
    }
  })();

  async function connectWith(input: { url: string; token: string; label: string }) {
    setBusy(true);
    setFeedback(null);

    const security = assessEndpointSecurity(input.url);
    if (security.blocked) {
      setFeedback({ tone: 'warn', message: security.message });
      setBusy(false);
      return;
    }

    try {
      const probe = createHttpApi({
        baseUrl: input.url,
        token: input.token,
        projectId: '',
        timeoutMs: 8_000,
      });
      const health = await probe.health();

      const desktop = await addDesktop({ label: input.label, url: input.url, token: input.token });
      await setDemoMode(false);

      // Projektet styr vilka missioner och vilken git-status som visas; ta det första som finns.
      try {
        const snapshot = await probe.snapshot();
        const first = snapshot.projects[0];
        if (first) await selectProject(first.id);
      } catch {
        // Projekt är inte kritiskt för att ansluta – det går att välja senare i inställningarna.
      }

      setFeedback({
        tone: 'success',
        message: `Ansluten till ${health.name}${health.port ? ` (port ${health.port})` : ''}. ${security.message}`,
      });
      router.replace('/(tabs)');
      void desktop;
    } catch (error) {
      setFeedback({ tone: 'danger', message: describeFailure(error, input.url) });
    } finally {
      setBusy(false);
      // En QR-kod kan läsas av flera gånger per sekund; vänta lite innan nästa försök.
      setTimeout(() => setScanned(false), 1_500);
    }
  }

  async function handlePayload(payload: string) {
    try {
      const parsed = parsePairingPayload(payload);
      setHost(parsed.url);
      setToken(parsed.token);
      if (parsed.label) setLabel(parsed.label);
      await connectWith({ url: parsed.url, token: parsed.token, label: parsed.label ?? label });
    } catch (error) {
      setFeedback({
        tone: 'danger',
        message: error instanceof PairingError ? error.message : 'Kunde inte tolka parningen.',
      });
    }
  }

  async function pasteFromClipboard() {
    const text = await Clipboard.getStringAsync();
    if (!text) {
      setFeedback({ tone: 'warn', message: 'Urklipp är tomt. Kopiera koden från Freevobe Desktop.' });
      return;
    }
    await handlePayload(text);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        <View style={styles.rowBetween}>
          <Title>Anslut till Desktop</Title>
          <Chip label="Stäng" onPress={() => router.back()} />
        </View>

        <View style={styles.row}>
          <Chip label="Skanna QR" selected={mode === 'scan'} onPress={() => setMode('scan')} />
          <Chip label="Skriv adress" selected={mode === 'manual'} onPress={() => setMode('manual')} />
        </View>

        {mode === 'scan' ? (
          <Card>
            {permission?.granted ? (
              <View
                style={{
                  borderRadius: radius.lg,
                  overflow: 'hidden',
                  height: 260,
                  backgroundColor: terminalSurface.background,
                }}
              >
                <CameraView
                  style={{ flex: 1 }}
                  facing="back"
                  barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                  onBarcodeScanned={
                    scanned || busy
                      ? undefined
                      : (result) => {
                          setScanned(true);
                          void handlePayload(result.data);
                        }
                  }
                />
              </View>
            ) : (
              <View style={{ gap: spacing.md }}>
                <Heading>Kameran behövs för QR-koden</Heading>
                <Body muted>
                  Du kan alltid skriva in adressen för hand i stället – kameran är bara ett smidigare
                  sätt att fylla i samma uppgifter.
                </Body>
                <Button
                  label={permission ? 'Tillåt kamera' : 'Fråga om kamera'}
                  variant="secondary"
                  onPress={() => void requestPermission()}
                />
              </View>
            )}
            <Button label="Klistra in kod från urklipp" variant="ghost" onPress={() => void pasteFromClipboard()} />
          </Card>
        ) : (
          <Card>
            <Field label="Namn" value={label} onChangeText={setLabel} autoCapitalize="sentences" />
            <Field
              label="Datorns adress"
              value={host}
              onChangeText={setHost}
              placeholder="192.168.1.20"
              keyboardType="url"
              hint="Samma adress som Freevobe Desktop visar under Mobile."
            />
            <Field label="Port" value={port} onChangeText={setPort} keyboardType="numeric" />
            <Field
              label="Parningskod"
              value={token}
              onChangeText={setToken}
              placeholder="Klistra in koden"
              secureTextEntry
              hint="Minst 16 tecken. Koden skapas i Freevobe Desktop och kan dras tillbaka där."
            />
            <Button
              label="Klistra in kod"
              variant="ghost"
              onPress={async () => {
                const text = await Clipboard.getStringAsync();
                if (text) setToken(text.trim());
              }}
            />
          </Card>
        )}

        {assessment ? (
          <View
            style={{
              backgroundColor: theme.cardStrong,
              borderRadius: radius.lg,
              padding: spacing.md,
              gap: spacing.xs,
            }}
          >
            <View style={styles.row}>
              <StatusDot
                color={
                  assessment.level === 'secure'
                    ? 'diffAdd'
                    : assessment.level === 'loopback'
                      ? 'teal'
                      : assessment.blocked
                        ? 'diffRemove'
                        : 'warn'
                }
              />
              <Caption muted={false}>
                {assessment.level === 'secure'
                  ? 'HTTPS'
                  : assessment.level === 'loopback'
                    ? 'Endast den här datorn'
                    : assessment.blocked
                      ? 'Blockerad adress'
                      : 'Okrypterat lokalt nätverk'}
              </Caption>
            </View>
            <Caption>{assessment.message}</Caption>
          </View>
        ) : null}

        {feedback ? (
          <View
            style={{
              borderWidth: 1,
              borderColor:
                feedback.tone === 'success'
                  ? theme.diffAdd
                  : feedback.tone === 'warn'
                    ? theme.warn
                    : theme.diffRemove,
              borderRadius: radius.lg,
              padding: spacing.md,
            }}
          >
            <Body>{feedback.message}</Body>
          </View>
        ) : null}

        {mode === 'manual' ? (
          <Button
            label="Anslut"
            busy={busy}
            onPress={() => {
              try {
                const url = normalizeHostUrl({ host, port });
                const security = assessEndpointSecurity(url);
                if (security.blocked) {
                  setFeedback({ tone: 'warn', message: security.message });
                  return;
                }
                if (token.trim().length < 16) {
                  setFeedback({
                    tone: 'danger',
                    message: 'Parningskoden ser för kort ut. Kopiera hela koden från Freevobe Desktop.',
                  });
                  return;
                }
                void connectWith({ url, token: token.trim(), label });
              } catch (error) {
                setFeedback({
                  tone: 'danger',
                  message:
                    error instanceof PairingError
                      ? error.message
                      : 'Kontrollera adressen och försök igen.',
                });
              }
            }}
          />
        ) : null}

        <View style={{ gap: spacing.xs }}>
          <Caption muted={false}>Säkerhet</Caption>
          <Body muted>
            Parningskoden sparas i telefonens nyckelring, aldrig i vanlig lagring. Appen talar bara
            med den dator du parar ihop med och skickar ingenting vidare – ingen telemetri, inget
            moln. Avvisar datorn koden måste du para ihop igen i Freevobe Desktop.
          </Body>
          <Mono>{`app:${newId('mobile')}`}</Mono>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function describeFailure(error: unknown, url: string): string {
  if (error instanceof ApiError) {
    if (error.code === 'unauthorized') {
      return 'Datorn nekade koden. Skapa en ny parningskod i Freevobe Desktop och försök igen.';
    }
    if (error.code === 'unreachable') {
      return `Kunde inte nå ${url}. Kontrollera att Freevobe Desktop kör, att porten stämmer och att telefonen är på samma nätverk.`;
    }
    return error.message;
  }
  return 'Något gick fel vid anslutningen.';
}
