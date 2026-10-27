import { NativeTabs } from 'expo-router/native-tabs';
import { useTheme } from '@/lib/theme';

/**
 * Flikarna använder plattformens egen fliklist (`NativeTabs` i SDK 58), vilket ger rätt känsla på
 * både iOS och Android: riktiga systemikoner, rätt höjd och plattformens egna animationer.
 *
 * Ikonerna anges med SF Symbols för iOS (`sf`) och Material Symbols för Android (`md`), så inga
 * bildfiler behöver underhållas.
 */
export default function TabsLayout() {
  const theme = useTheme();

  return (
    <NativeTabs
      backgroundColor={theme.scheme === 'dark' ? theme.card : theme.bg}
      tintColor={theme.accent}
      iconColor={{ default: theme.muted, selected: theme.accent }}
      labelStyle={{ color: theme.muted, selected: { color: theme.accent } }}
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Missions</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="square.stack.3d.up.fill" md="layers" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="chat">
        <NativeTabs.Trigger.Label>Chat</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="bubble.left.and.bubble.right.fill" md="chat" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="approvals">
        <NativeTabs.Trigger.Label>Approvals</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="checkmark.shield.fill" md="verified_user" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="logs">
        <NativeTabs.Trigger.Label>Logs</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="terminal.fill" md="terminal" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="gearshape.fill" md="settings" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
