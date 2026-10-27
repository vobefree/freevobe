import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, View } from 'react-native';
import { spacing } from '@/constants/theme';
import { useSnapshot } from '@/hooks/use-api';
import { ensureNotificationPermission } from '@/lib/notifications';
import { formatRelativeTime } from '@/lib/format';
import { assessEndpointSecurity } from '@/lib/pairing';
import { useConnection } from '@/state/connection';
import { useSettings, type ThemeMode } from '@/state/settings';
import {
  Body,
  Button,
  Caption,
  Card,
  Chip,
  Field,
  Heading,
  KeyValue,
  Mono,
  Screen,
  SectionTitle,
  StatusDot,
  styles,
} from '@/components/ui';

/**
 * Inställningar: vilka datorer som är ihopparade, vilket projekt som visas, tema, notiser och
 * information om appen.
 */
export default function SettingsScreen() {
  const desktops = useConnection((state) => state.desktops);
  const activeId = useConnection((state) => state.activeId);
  const projectId = useConnection((state) => state.projectId);
  const selectDesktop = useConnection((state) => state.selectDesktop);
  const selectProject = useConnection((state) => state.selectProject);
  const removeDesktop = useConnection((state) => state.removeDesktop);
  const disconnect = useConnection((state) => state.disconnect);

  const themeMode = useSettings((state) => state.themeMode);
  const setThemeMode = useSettings((state) => state.setThemeMode);
  const notifications = useSettings((state) => state.notifications);
  const setNotification = useSettings((state) => state.setNotification);
  const demoMode = useSettings((state) => state.demoMode);
  const setDemoMode = useSettings((state) => state.setDemoMode);

  const snapshot = useSnapshot(!demoMode && activeId !== null);
  const [permissionNote, setPermissionNote] = useState<string | null>(null);

  const themeOptions: { value: ThemeMode; label: string }[] = [
    { value: 'dark', label: 'Mörkt' },
    { value: 'light', label: 'Ljust' },
    { value: 'system', label: 'Följ telefonen' },
  ];

  return (
    <Screen contentStyle={{ paddingBottom: spacing.xxxl }}>
      <View>
        <Caption muted={false}>Settings</Caption>
        <Body muted>Anslutningar, utseende och notiser.</Body>
      </View>

      <View style={{ gap: spacing.md }}>
        <SectionTitle
          title="Datorer"
          action={<Chip label="Lägg till" tone="accent" onPress={() => router.push('/connect')} />}
        />
        {desktops.length === 0 ? (
          <Card>
            <Body muted>Ingen dator är ihopparad. Tryck “Lägg till” och skanna QR-koden i Freevobe Desktop.</Body>
          </Card>
        ) : (
          desktops.map((desktop) => {
            const security = assessEndpointSecurity(desktop.url);
            const active = desktop.id === activeId;
            return (
              <Card key={desktop.id} tone={active ? 'accent' : 'default'}>
                <View style={styles.rowBetween}>
                  <View style={[styles.row, { flexShrink: 1 }]}>
                    <StatusDot color={active ? 'teal' : 'borderStrong'} />
                    <Heading style={{ flexShrink: 1 }}>{desktop.label}</Heading>
                  </View>
                  {active ? <Chip label="Aktiv" tone="teal" /> : null}
                </View>
                <Mono>{desktop.url}</Mono>
                <KeyValue
                  label="Tillagd"
                  value={formatRelativeTime(desktop.addedAt)}
                />
                <KeyValue
                  label="Trafik"
                  value={
                    security.level === 'secure'
                      ? 'HTTPS'
                      : security.level === 'loopback'
                        ? 'Endast datorn'
                        : 'Okrypterat lokalt nätverk'
                  }
                />
                <View style={[styles.row, { marginTop: spacing.sm }]}>
                  {!active ? (
                    <Chip label="Använd" tone="accent" onPress={() => void selectDesktop(desktop.id)} />
                  ) : (
                    <Chip label="Koppla bort" onPress={() => void disconnect()} />
                  )}
                  <Chip
                    label="Ta bort"
                    tone="danger"
                    onPress={() =>
                      Alert.alert('Ta bort datorn?', `${desktop.label} glöms bort, inklusive parningskoden.`, [
                        { text: 'Avbryt', style: 'cancel' },
                        { text: 'Ta bort', style: 'destructive', onPress: () => void removeDesktop(desktop.id) },
                      ])
                    }
                  />
                </View>
              </Card>
            );
          })
        )}
      </View>

      {snapshot.data && snapshot.data.projects.length > 0 ? (
        <View style={{ gap: spacing.md }}>
          <SectionTitle title="Projekt" />
          <Card>
            <Caption>Missioner och git-status hämtas för det här projektet.</Caption>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {snapshot.data.projects.map((project) => (
                <Chip
                  key={project.id}
                  label={project.name}
                  selected={project.id === projectId}
                  onPress={() => void selectProject(project.id)}
                />
              ))}
            </View>
            <KeyValue label="Behörighetsläge" value={
              snapshot.data.projects.find((project) => project.id === projectId)?.permissionMode ??
              snapshot.data.projects[0]?.permissionMode ??
              '—'
            } />
          </Card>
        </View>
      ) : null}

      <View style={{ gap: spacing.md }}>
        <SectionTitle title="Utseende" />
        <Card>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {themeOptions.map((option) => (
              <Chip
                key={option.value}
                label={option.label}
                selected={themeMode === option.value}
                onPress={() => void setThemeMode(option.value)}
              />
            ))}
          </View>
          <Caption>
            Appen är mörk som standard och använder samma färger som skrivbordsappen: elektrisk lila
            för handlingar och teal för sådant som stannar lokalt.
          </Caption>
        </Card>
      </View>

      <View style={{ gap: spacing.md }}>
        <SectionTitle title="Notiser" />
        <Card>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            <Chip
              label={notifications.enabled ? 'Notiser på' : 'Notiser av'}
              tone={notifications.enabled ? 'teal' : 'neutral'}
              selected={notifications.enabled}
              onPress={() => void setNotification('enabled', !notifications.enabled)}
            />
            <Chip
              label="Godkännanden"
              selected={notifications.approvals}
              onPress={() => void setNotification('approvals', !notifications.approvals)}
            />
            <Chip
              label="Mission klart"
              selected={notifications.missionDone}
              onPress={() => void setNotification('missionDone', !notifications.missionDone)}
            />
            <Chip
              label="Testfel"
              selected={notifications.testFailure}
              onPress={() => void setNotification('testFailure', !notifications.testFailure)}
            />
            <Chip
              label="Agentfel"
              selected={notifications.errors}
              onPress={() => void setNotification('errors', !notifications.errors)}
            />
          </View>
          <Button
            label="Tillåt notiser i systemet"
            variant="secondary"
            onPress={async () => {
              const result = await ensureNotificationPermission();
              setPermissionNote(result.message);
            }}
          />
          {permissionNote ? <Caption>{permissionNote}</Caption> : null}
          <Caption>
            v1 använder lokala notiser: de kommer medan appen kör eller precis har öppnats. Notiser när
            appen är helt stängd kräver en vidarebefordran från datorn.
          </Caption>
        </Card>
      </View>

      <View style={{ gap: spacing.md }}>
        <SectionTitle title="Demoläge" />
        <Card>
          <View style={styles.row}>
            <Chip
              label={demoMode ? 'På' : 'Av'}
              tone={demoMode ? 'accent' : 'neutral'}
              selected={demoMode}
              onPress={() => void setDemoMode(!demoMode)}
            />
            <Body muted style={{ flexShrink: 1 }}>
              Visar påhittad data utan att röra din dator. Bra för att prova appen eller visa den för
              någon.
            </Body>
          </View>
        </Card>
      </View>

      <View style={{ gap: spacing.md }}>
        <SectionTitle title="Om" />
        <Card>
          <KeyValue label="App" value="Freevobe Mobile" />
          <KeyValue label="Version" value="1.0.0" />
          <KeyValue label="Läge" value={demoMode ? 'Demo' : activeId ? 'Ansluten dator' : 'Ingen dator'} />
          <KeyValue label="Kodspråk" value="TypeScript · Expo" />
          <Button
            label="Källor och licens (MIT)"
            variant="ghost"
            onPress={() => void Linking.openURL('https://github.com/freevobe/freevobe')}
          />
          <Caption>
            Ingen telemetri. Ingen inloggning. Ingen data lämnar din dator eller telefon.
          </Caption>
        </Card>
      </View>

      <Field
        label="Diagnostik"
        value={snapshot.data?.health.name ? `${snapshot.data.health.name}:${snapshot.data.health.port}` : 'mock'}
        onChangeText={() => undefined}
        hint="Endast visning – används för att se vilken dator appen talar med."
      />
    </Screen>
  );
}
