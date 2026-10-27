import { useColorScheme } from 'react-native';
import { palettes, type Palette } from '@/constants/theme';
import { useSettings } from '@/state/settings';

/**
 * Färgerna för aktuellt tema. Appen är mörk som standard, men följer telefonen om användaren väljer
 * "system" i inställningarna – och kan låsas till mörkt eller ljust.
 */
export function useTheme(): Palette {
  const systemScheme = useColorScheme();
  const mode = useSettings((state) => state.themeMode);

  const effective = mode === 'system' ? (systemScheme === 'light' ? 'light' : 'dark') : mode;
  return palettes[effective];
}
