export const colors = {
  background: '#04111C',
  surface: '#12242F',
  surfaceAlt: '#0C1A22',
  border: 'rgba(238, 244, 246, 0.22)',
  highlight: 'rgba(255, 255, 255, 0.16)',
  primary: '#E8F1FF',
  primaryForeground: '#06121A',
  primaryMuted: '#16303A',
  accent: '#9FF3E4',
  text: '#EEF4F6',
  textMuted: '#9EA7AC',
  textFaint: '#5C6A72',
  danger: '#FF5C5C',
  warning: '#FFC24B',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radii = {
  xs: 4,
  chip: 4,
  sm: 4,
  md: 4,
  lg: 4,
  xl: 8,
  pill: 4,
} as const;

export const fonts = {
  regular: 'SpaceGrotesk_400Regular',
  medium: 'SpaceGrotesk_500Medium',
  semiBold: 'SpaceGrotesk_600SemiBold',
  bold: 'SpaceGrotesk_700Bold',
} as const;

export const typography = {
  h1: { fontSize: 32, fontWeight: '600' as const, fontFamily: fonts.semiBold, letterSpacing: -0.6, color: colors.text },
  h2: { fontSize: 22, fontWeight: '600' as const, fontFamily: fonts.semiBold, letterSpacing: -0.4, color: colors.text },
  h3: { fontSize: 18, fontWeight: '600' as const, fontFamily: fonts.semiBold, letterSpacing: -0.3, color: colors.text },
  body: { fontSize: 15, fontWeight: '400' as const, fontFamily: fonts.regular, color: colors.text },
  bodyMuted: { fontSize: 14, fontWeight: '400' as const, fontFamily: fonts.regular, color: colors.textMuted },
  caption: { fontSize: 12, fontWeight: '500' as const, fontFamily: fonts.medium, color: colors.textFaint },
  button: {
    fontSize: 13,
    fontWeight: '600' as const,
    fontFamily: fonts.semiBold,
    letterSpacing: 0.6,
    color: colors.text,
  },
  stat: {
    fontSize: 32,
    fontWeight: '700' as const,
    fontFamily: fonts.bold,
    fontVariant: ['tabular-nums' as const],
    letterSpacing: -0.5,
    color: colors.text,
  },
  label: { fontSize: 12, fontWeight: '500' as const, fontFamily: fonts.medium, letterSpacing: 0.8, color: colors.textFaint },
};

export const navigationTheme = {
  dark: true,
  colors: {
    primary: colors.primary,
    background: colors.background,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    notification: colors.accent,
  },
  fonts: {
    regular: { fontFamily: fonts.regular, fontWeight: '400' as const },
    medium: { fontFamily: fonts.medium, fontWeight: '500' as const },
    bold: { fontFamily: fonts.bold, fontWeight: '700' as const },
    heavy: { fontFamily: fonts.bold, fontWeight: '700' as const },
  },
};
