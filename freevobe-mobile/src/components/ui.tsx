import type { ReactElement, ReactNode } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { mono, radius, spacing, touchTarget, typography, type Palette } from '@/constants/theme';
import { useTheme } from '@/lib/theme';

/**
 * Grundkomponenterna. Allt är minst 44 punkter högt (touchTarget) och färgerna kommer från temat, så
 * att mörkt och ljust läge fungerar utan dubbla komponenter.
 */

/**
 * Översta marginalen i en skärm.
 *
 * På iOS och Android ritar fliklisten längst ned. På webben lägger NativeTabs den högst upp, ovanpå
 * innehållet, och då hamnar rubriken under listen. Skärmar som bygger sin egen layout (chatten) måste
 * använda samma mått som `Screen`, annars glider de isär.
 */
export const screenTopPadding = Platform.OS === 'web' ? 76 : spacing.lg;

export function Screen({
  children,
  scroll = true,
  contentStyle,
  refreshControl,
}: {
  children: ReactNode;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  /** Skickas till ScrollView, så att dra-ned-för-att-uppdatera fungerar på riktigt. */
  refreshControl?: ReactElement;
}) {
  const theme = useTheme();
  const padding = {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingTop: screenTopPadding,
  };

  if (!scroll) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: theme.bg }]} edges={['top']}>
        <View style={[styles.flex, padding, contentStyle]}>{children}</View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.bg }]} edges={['top']}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[padding, contentStyle]}
        keyboardShouldPersistTaps="handled"
        {...(refreshControl ? { refreshControl } : {})}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Card({
  children,
  style,
  tone = 'default',
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  tone?: 'default' | 'strong' | 'accent';
}) {
  const theme = useTheme();
  const background =
    tone === 'accent' ? theme.cardStrong : tone === 'strong' ? theme.cardStrong : theme.card;
  return (
    <View
      style={[
        {
          backgroundColor: background,
          borderColor: tone === 'accent' ? theme.accent : theme.border,
          borderWidth: 1,
          borderRadius: radius.xl,
          padding: spacing.lg,
          gap: spacing.sm,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Title({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const theme = useTheme();
  return <Text style={[{ ...typography.title, color: theme.fg }, style]}>{children}</Text>;
}

export function Display({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const theme = useTheme();
  return <Text style={[{ ...typography.display, color: theme.fg }, style]}>{children}</Text>;
}

export function Heading({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const theme = useTheme();
  return <Text style={[{ ...typography.heading, color: theme.fg }, style]}>{children}</Text>;
}

export function Body({
  children,
  style,
  muted = false,
}: {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
  muted?: boolean;
}) {
  const theme = useTheme();
  return (
    <Text style={[{ ...typography.body, color: muted ? theme.muted : theme.fg }, style]}>
      {children}
    </Text>
  );
}

export function Caption({
  children,
  style,
  muted = true,
}: {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
  muted?: boolean;
}) {
  const theme = useTheme();
  return (
    <Text style={[{ ...typography.caption, color: muted ? theme.muted : theme.fg }, style]}>
      {children}
    </Text>
  );
}

export function Mono({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const theme = useTheme();
  return (
    <Text
      style={[{ fontFamily: mono, fontSize: 12.5, lineHeight: 19, color: theme.fg }, style]}
    >
      {children}
    </Text>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  busy = false,
  icon,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  busy?: boolean;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const palette: Record<ButtonVariant, { background: string; text: string; border: string }> = {
    primary: { background: theme.accent, text: theme.onAccent, border: theme.accent },
    secondary: { background: theme.cardStrong, text: theme.fg, border: theme.borderStrong },
    ghost: { background: 'transparent', text: theme.muted, border: theme.border },
    danger: { background: theme.cardStrong, text: theme.diffRemove, border: theme.diffRemove },
  };
  const colors = palette[variant];
  const inactive = disabled || busy;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy }}
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        {
          minHeight: touchTarget,
          paddingHorizontal: spacing.lg,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.background,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: spacing.sm,
          opacity: inactive ? 0.5 : pressed ? 0.82 : 1,
        },
        style,
      ]}
    >
      {busy ? <ActivityIndicator size="small" color={colors.text} /> : icon}
      <Text style={{ ...typography.heading, color: colors.text }}>{label}</Text>
    </Pressable>
  );
}

export function Chip({
  label,
  tone = 'neutral',
  onPress,
  selected = false,
}: {
  label: string;
  tone?: 'neutral' | 'accent' | 'success' | 'warn' | 'danger' | 'teal';
  onPress?: () => void;
  selected?: boolean;
}) {
  const theme = useTheme();
  const tones: Record<string, { border: string; text: string; background: string }> = {
    neutral: { border: theme.border, text: theme.muted, background: 'transparent' },
    accent: { border: theme.accent, text: theme.accentSoft, background: 'transparent' },
    teal: { border: theme.teal, text: theme.teal, background: 'transparent' },
    success: { border: theme.diffAdd, text: theme.diffAdd, background: 'transparent' },
    warn: { border: theme.warn, text: theme.warn, background: 'transparent' },
    danger: { border: theme.diffRemove, text: theme.diffRemove, background: 'transparent' },
  };
  const colors = tones[tone] ?? tones.neutral;
  const content = (
    <View
      style={{
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: selected ? theme.accent : colors.border,
        backgroundColor: selected ? theme.accent : colors.background,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        minHeight: 32,
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          ...typography.caption,
          color: selected ? theme.onAccent : colors.text,
        }}
      >
        {label}
      </Text>
    </View>
  );

  if (!onPress) return content;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={6}>
      {content}
    </Pressable>
  );
}

export function StatusDot({ color }: { color?: keyof Palette }) {
  const theme = useTheme();
  return (
    <View
      style={{
        width: 9,
        height: 9,
        borderRadius: radius.pill,
        backgroundColor: color ? (theme[color] as string) : theme.teal,
      }}
    />
  );
}

export function SectionTitle({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.rowBetween}>
      <Heading>{title}</Heading>
      {action}
    </View>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <Card style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxl }}>
      <StatusDot color="teal" />
      <Heading>{title}</Heading>
      <Body muted style={{ textAlign: 'center' }}>
        {body}
      </Body>
      {action}
    </Card>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  secureTextEntry = false,
  autoCapitalize = 'none',
  hint,
  autoFocus = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric' | 'url';
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences';
  hint?: string;
  autoFocus?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={{ gap: spacing.xs }}>
      <Caption muted={false}>{label}</Caption>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.muted}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        autoFocus={autoFocus}
        accessibilityLabel={label}
        style={{
          minHeight: touchTarget,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: theme.border,
          backgroundColor: theme.bgSoft,
          color: theme.fg,
          paddingHorizontal: spacing.md,
          fontSize: 15,
        }}
      />
      {hint ? <Caption>{hint}</Caption> : null}
    </View>
  );
}

export function Divider() {
  const theme = useTheme();
  return <View style={{ height: 1, backgroundColor: theme.border }} />;
}

export function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <View style={[styles.rowBetween, { alignItems: 'flex-start' }]}>
      <Caption>{label}</Caption>
      <Body style={{ flexShrink: 1, textAlign: 'right' }}>{value}</Body>
    </View>
  );
}

export const styles = StyleSheet.create({
  flex: { flex: 1 },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
