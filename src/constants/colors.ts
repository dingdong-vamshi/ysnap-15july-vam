/**
 * YSnap Design System — Color Tokens
 * Premium, white-first theme for light mode, and dark plum-black theme for dark mode.
 */

export const lightColors = {
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
};

export const darkColors: typeof lightColors = {
  // Backgrounds
  background: '#0B0A0B',
  backgroundSoft: '#161416',
  backgroundMuted: '#201D20',

  // Surfaces
  surface: '#161416',
  surfaceSoft: '#201D20',
  surfaceSelected: '#FFFFFF',
  surfaceWarning: '#2C1E0A',
  surfaceSuccess: '#0D2E1F',
  surfaceError: '#351114',

  // Text
  textPrimary: '#FFFFFF',
  textSecondary: '#B9B9C0',
  textMuted: '#9B9BA1',
  textSubtle: '#7B7B82',
  textInverse: '#0B0A0B',

  // Primary
  primary: '#FFFFFF',
  primaryPressed: '#E7E6EB',
  disabled: '#4A494E',

  // Borders
  border: '#2C2B30',
  borderStrong: '#3E3D42',
  borderFocused: '#FFFFFF',

  // Accents
  accentBlue: '#5B8DEF',
  accentPurple: '#9A8CE6',
  accentGreen: '#4D9A76',
  accentOrange: '#E2A05C',
  accentCoral: '#D95C67',

  // Semantic
  success: '#46A376',
  successLight: '#0D2E1F',
  warning: '#C6882C',
  warningLight: '#2C1E0A',
  error: '#DC5361',
  errorLight: '#351114',

  // Overlays
  overlay: 'rgba(0, 0, 0, 0.6)',
  overlayLight: 'rgba(255, 255, 255, 0.08)',

  // Skeleton
  skeletonBase: '#201D20',
  skeletonHighlight: '#2C292C',
};

// Global mutable theme state
export let currentThemeMode: 'light' | 'dark' = 'light';

export function setThemeMode(mode: 'light' | 'dark') {
  currentThemeMode = mode;
}

export function getActiveColors() {
  return currentThemeMode === 'dark' ? darkColors : lightColors;
}

// Export colors as an any Proxy to avoid TS compiler resolution crashes
export const colors: any = new Proxy({} as any, {
  get(target, prop) {
    return getActiveColors()[prop as keyof typeof lightColors];
  }
});

export type ColorToken = keyof typeof lightColors;
