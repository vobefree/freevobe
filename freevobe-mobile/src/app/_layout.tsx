import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, router } from 'expo-router';
import { hideAsync, preventAutoHideAsync } from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  addNotificationResponseListener,
  configureNotificationHandler,
} from '@/lib/notifications';
import { useTheme } from '@/lib/theme';
import { useConnection } from '@/state/connection';
import { useSettings } from '@/state/settings';

preventAutoHideAsync();
configureNotificationHandler();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 10_000 },
  },
});

export default function RootLayout() {
  const ready = useHydrated();
  const theme = useTheme();

  const navigationTheme = theme.scheme === 'dark' ? DarkTheme : DefaultTheme;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <ThemeProvider
            value={{
              ...navigationTheme,
              colors: {
                ...navigationTheme.colors,
                primary: theme.accent,
                background: theme.bg,
                card: theme.card,
                text: theme.fg,
                border: theme.border,
              },
            }}
          >
            <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
            {ready ? <RootStack /> : <View style={{ flex: 1, backgroundColor: theme.bg }} />}
          </ThemeProvider>
        </SafeAreaProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

function RootStack() {
  useNotificationRouting();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: 'transparent' },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="index" options={{ animation: 'none' }} />
      <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
      <Stack.Screen name="connect" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="(tabs)" options={{ animation: 'none' }} />
      <Stack.Screen name="mission/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="approval/[id]" options={{ headerShown: false }} />
    </Stack>
  );
}

/** Läser den sparade anslutningen och inställningarna innan appen visas. */
function useHydrated(): boolean {
  const hydrateConnection = useConnection((state) => state.hydrate);
  const hydrateSettings = useSettings((state) => state.hydrate);
  // Två separata anrop: hooks får aldrig kortslutas med &&.
  const connectionReady = useConnection((state) => state.ready);
  const settingsReady = useSettings((state) => state.ready);
  const ready = connectionReady && settingsReady;
  const [marked, setMarked] = useState(false);

  useEffect(() => {
    void Promise.all([hydrateConnection(), hydrateSettings()]).then(() => setMarked(true));
  }, [hydrateConnection, hydrateSettings]);

  useEffect(() => {
    if (ready && marked) void hideAsync();
  }, [ready, marked]);

  return ready && marked;
}

/** En notis om ett godkännande ska leda till godkännandelistan, inte bara till appen. */
function useNotificationRouting(): void {
  useEffect(
    () =>
      addNotificationResponseListener((data) => {
        if (data.kind === 'approval') router.push('/approvals');
        else router.push('/');
      }),
    [],
  );
}
