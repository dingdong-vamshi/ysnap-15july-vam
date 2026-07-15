import { Platform } from 'react-native';

/**
 * YSnap Design System — Typography
 * Native system fonts for platform quality
 */
const fontFamily = Platform.select({
  ios: 'System',
  android: 'Roboto',
  default: 'System',
});

export const typography = {
  // Cal AI Specification Tokens
  display: {
    fontFamily,
    fontSize: 30,
    fontWeight: '700' as const,
    lineHeight: 35,
  },
  heading1: {
    fontFamily,
    fontSize: 26,
    fontWeight: '700' as const,
    lineHeight: 31,
  },
  heading2: {
    fontFamily,
    fontSize: 22,
    fontWeight: '700' as const,
    lineHeight: 27,
  },
  heading3: {
    fontFamily,
    fontSize: 18,
    fontWeight: '600' as const,
    lineHeight: 23,
  },
  bodyLarge: {
    fontFamily,
    fontSize: 17,
    fontWeight: '400' as const,
    lineHeight: 25,
  },
  body: {
    fontFamily,
    fontSize: 15,
    fontWeight: '400' as const,
    lineHeight: 21,
  },
  label: {
    fontFamily,
    fontSize: 14,
    fontWeight: '600' as const,
    lineHeight: 18,
  },
  bodySmall: {
    fontFamily,
    fontSize: 13,
    fontWeight: '400' as const,
    lineHeight: 18,
  },
  caption: {
    fontFamily,
    fontSize: 12,
    fontWeight: '400' as const,
    lineHeight: 16,
  },
  micro: {
    fontFamily,
    fontSize: 11,
    fontWeight: '500' as const,
    lineHeight: 14,
  },

  // Backwards compatibility aliases
  heading4: {
    fontFamily,
    fontSize: 17,
    fontWeight: '600' as const,
    lineHeight: 22,
  },
  bodyMedium: {
    fontFamily,
    fontSize: 15,
    fontWeight: '500' as const,
    lineHeight: 22,
  },
  bodySemibold: {
    fontFamily,
    fontSize: 15,
    fontWeight: '600' as const,
    lineHeight: 22,
  },
  captionMedium: {
    fontFamily,
    fontSize: 13,
    fontWeight: '500' as const,
    lineHeight: 18,
  },
  small: {
    fontFamily,
    fontSize: 12,
    fontWeight: '400' as const,
    lineHeight: 16,
  },
  smallMedium: {
    fontFamily,
    fontSize: 12,
    fontWeight: '500' as const,
    lineHeight: 16,
  },
  button: {
    fontFamily,
    fontSize: 14, // Matches 14 pt label specification
    fontWeight: '600' as const,
    lineHeight: 18,
  },
  buttonSmall: {
    fontFamily,
    fontSize: 12,
    fontWeight: '600' as const,
    lineHeight: 16,
  },
  tabular: {
    fontFamily,
    fontSize: 15,
    fontWeight: '500' as const,
    lineHeight: 22,
    fontVariant: ['tabular-nums'] as any,
  },
} as const;

export type TypographyToken = keyof typeof typography;
