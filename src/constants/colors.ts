/**
 * YSnap Design System — Color Tokens
 * Cal AI-inspired white-first palette with plum-black primary controls
 */
export const colors = {
  // Backgrounds
  background: '#FFFFFF',
  backgroundSoft: '#F8F8FC',
  backgroundMuted: '#F3F2F6',

  // Surfaces
  surface: '#FFFFFF',
  surfaceSoft: '#F8F8FC',
  surfaceSelected: '#201820',
  surfaceWarning: '#FFF8EC',
  surfaceSuccess: '#F1FAF5',
  surfaceError: '#FFF0F1',

  // Text
  textPrimary: '#0B0A0B',
  textSecondary: '#67676C',
  textMuted: '#7B7B82',
  textSubtle: '#9B9BA1',
  textInverse: '#FFFFFF',

  // Primary (plum-black)
  primary: '#201820',
  primaryPressed: '#302530',
  disabled: '#B9B7BD',

  // Borders
  border: '#E7E6EB',
  borderStrong: '#D8D7DC',
  borderFocused: '#201820',

  // Accents (semantic, restrained)
  accentBlue: '#5B8DEF',
  accentPurple: '#7C6CD0',
  accentGreen: '#4D9A76',
  accentOrange: '#E2A05C',
  accentCoral: '#D95C67',

  // Semantic
  success: '#36845F',
  successLight: '#F1FAF5',
  warning: '#A96A17',
  warningLight: '#FFF8EC',
  error: '#C13E4C',
  errorLight: '#FFF0F1',

  // Overlays
  overlay: 'rgba(9, 9, 9, 0.4)',
  overlayLight: 'rgba(9, 9, 9, 0.08)',

  // Skeleton
  skeletonBase: '#F3F2F6',
  skeletonHighlight: '#E9E7EC',
} as const;

export type ColorToken = keyof typeof colors;
