import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { radius, spacing } from '@/constants/theme';
import { useTheme } from '@/lib/theme';
import { useSettings } from '@/state/settings';
import { Body, Button, Card, Caption, Chip, Display, Heading, StatusDot, styles } from '@/components/ui';

/**
 * Välkomstskärmen. Tre vägar in: skanna QR-koden som skrivbordet visar, skriva in adressen eller
 * klistra in parningskoden. Säkerhetsinformationen står direkt på skärmen – ingen ska behöva gissa
 * vad en parning innebär.
 */
export default function Onboarding() {
  const theme = useTheme();
  const setDemoMode = useSettings((state) => state.setDemoMode);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl }}>
        <View style={{ gap: spacing.md, marginTop: spacing.xl }}>
          <View style={styles.row}>
            <StatusDot color="accent" />
            <Chip label="Freevobe Mobile" tone="accent" />
          </View>
          <Display>Control your local Freevobe agent.</Display>
          <Body muted>
            Connect to your computer and vobe from anywhere on your network. Filändringar,
            terminalkommandon och modellkörningar stannar på datorn – telefonen är fjärrkontrollen.
          </Body>
        </View>

        <View style={{ gap: spacing.md }}>
          <Button label="Anslut till Desktop" onPress={() => router.push('/connect')} />
          <Button
            label="Titta i demoläge först"
            variant="secondary"
            onPress={async () => {
              await setDemoMode(true);
              router.replace('/(tabs)');
            }}
          />
        </View>

        <Card>
          <Heading>Så parar du ihop</Heading>
          <View style={{ gap: spacing.sm }}>
            <Body muted>1. Öppna Freevobe Desktop på datorn.</Body>
            <Body muted>2. Välj “Mobile” och visa QR-koden.</Body>
            <Body muted>3. Skanna koden här – eller skriv in datorns adress och klistra in koden.</Body>
          </View>
          <View
            style={{
              borderTopWidth: 1,
              borderTopColor: theme.border,
              paddingTop: spacing.sm,
              gap: spacing.xs,
            }}
          >
            <View style={styles.row}>
              <StatusDot color="warn" />
              <Caption muted={false}>Din telefon och dator måste vara på samma nätverk.</Caption>
            </View>
            <Caption>
              Parningskoden sparas i telefonens nyckelring och kan dras tillbaka när som helst i
              Freevobe Desktop. Appen skickar aldrig kod eller prompter till någon tredje part.
            </Caption>
          </View>
        </Card>

        <View
          style={{
            backgroundColor: theme.cardStrong,
            borderRadius: radius.lg,
            padding: spacing.lg,
            gap: spacing.xs,
          }}
        >
          <Caption muted={false}>Vad appen kan i v1</Caption>
          <Body muted>
            Starta och följ missions, läsa diffar, godkänna eller avböja filändringar och kommandon,
            följa loggar och få notiser. Att köra godtyckliga kommandon från telefonen är medvetet
            avstängt.
          </Body>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
