import { Platform } from 'react-native';

/**
 * Freevobe-varumärket. Samma värden som landningssidan (freevobe/src/app/globals.css), så att
 * telefonen, skrivbordsappen och webbplatsen ser ut som samma produkt.
 *
 * Mörkt tema är standard: accenten är elektrisk lila och teal markerar "lokalt/privat".
 */
export const darkPalette = {
  scheme: 'dark' as const,
  bg: '#050505',
  bgSoft: '#0a0a0c',
  card: '#0c0c11',
  cardStrong: '#121219',
  border: '#1f1f29',
  borderStrong: '#2c2c3a',
  fg: '#f6f6f8',
  muted: '#9b9baa',
  accent: '#8b5cf6',
  accentStrong: '#7c3aed',
  accentSoft: '#b79cff',
  onAccent: '#ffffff',
  teal: '#2dd4bf',
  terminal: '#b7f7a8',
  diffAdd: '#4ade80',
  diffRemove: '#f87171',
  warn: '#fbbf24',
};

/**
 * Ljust läge har samma struktur men mörkare accenter: #8b5cf6 mot vitt når bara 3,4:1 och duger
 * inte som textfärg. Diff- och terminalfärgerna byts mot mörkare varianter av samma skäl.
 */
export const lightPalette: Palette = {
  ...darkPalette,
  scheme: 'light',
  bg: '#ffffff',
  bgSoft: '#f6f6f9',
  card: '#ffffff',
  cardStrong: '#f3f3f7',
  border: '#e5e5ec',
  borderStrong: '#d3d3de',
  fg: '#0a0a0f',
  muted: '#55556a',
  accent: '#7c3aed',
  accentStrong: '#6d28d9',
  accentSoft: '#6d28d9',
  teal: '#0f766e',
  terminal: '#15803d',
  diffAdd: '#15803d',
  diffRemove: '#b91c1c',
  warn: '#b45309',
};

export type Palette = Omit<typeof darkPalette, 'scheme'> & { scheme: 'light' | 'dark' };

export const palettes = { dark: darkPalette as Palette, light: lightPalette };

/** Allt är 4-punktersraster. Knappar och rader är minst touchTarget höga (44 pt enligt Apple). */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  pill: 999,
} as const;

export const touchTarget = 44;

export const typography = {
  display: { fontSize: 32, lineHeight: 38, fontWeight: '700' },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700' },
  heading: { fontSize: 17, lineHeight: 23, fontWeight: '600' },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' },
  small: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  caption: { fontSize: 11.5, lineHeight: 16, fontWeight: '500' },
} as const;

export const mono = Platform.select({
  ios: 'ui-monospace',
  android: 'monospace',
  default: 'monospace',
}) as string;

/** Terminal- och loggytor är alltid mörka, precis som i skrivbordsappen. */
export const terminalSurface = {
  background: '#08080b',
  border: '#1f1f29',
  text: '#d6d6e0',
} as const;
