import { Redirect } from 'expo-router';
import { useConnection } from '@/state/connection';
import { useSettings } from '@/state/settings';

/**
 * Ingången. Har användaren en parad dator (eller valt demoläget) går vi rakt in i appen – annars
 * möts hen av välkomstskärmen. Att styra det här i stället för med en `redirect` på en skärm är vad
 * SDK 58 kräver: `Stack.Screen` tar inte längre emot `redirect`.
 */
export default function Index() {
  const hasDesktop = useConnection((state) => state.activeId !== null && state.activeToken !== null);
  const demoMode = useSettings((state) => state.demoMode);

  if (!hasDesktop && !demoMode) return <Redirect href="/onboarding" />;
  return <Redirect href="/(tabs)" />;
}
