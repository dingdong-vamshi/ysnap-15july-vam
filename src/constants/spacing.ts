/**
 * YSnap Design System — Spacing & Layout Constants
 */
export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
  '5xl': 64,
} as const;

export const layout = {
  /** Horizontal page margin */
  pageMargin: 24,
  /** Standard card inner padding */
  cardPadding: 18,
  /** Card border radius */
  cardRadius: 20,
  /** Primary button height */
  buttonHeight: 56,
  /** Small button height */
  buttonHeightSmall: 44,
  /** Button pill radius */
  buttonRadius: 28,
  /** Input field height */
  inputHeight: 54,
  /** Input border radius */
  inputRadius: 12,
  /** Min touch target */
  touchTarget: 44,
  /** Bottom tab bar height */
  tabBarHeight: 84,
  /** Bottom sheet handle width */
  sheetHandleWidth: 36,
  /** Bottom sheet handle height */
  sheetHandleHeight: 4,
  /** Max content width for tablets */
  maxContentWidth: 680,
} as const;

export const shadows = {
  sm: {
    shadowColor: '#090909',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  md: {
    shadowColor: '#090909',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  lg: {
    shadowColor: '#090909',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 5,
  },
} as const;

export const animation = {
  fast: 150,
  normal: 250,
  slow: 400,
  spring: {
    damping: 15,
    stiffness: 150,
    mass: 1,
  },
} as const;

export type SpacingToken = keyof typeof spacing;
