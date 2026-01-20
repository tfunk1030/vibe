/**
 * Design Tokens for Pips Solver
 *
 * All colors, spacing, and sizing values should come from this file.
 * Never use hardcoded colors in components.
 */

export const colors = {
  // Primary actions - teal
  primary: {
    default: '#0D9488',
    pressed: '#0F766E',
    disabled: '#99F6E4',
  },

  // Warning/caution - amber
  warning: {
    default: '#F59E0B',
    pressed: '#D97706',
    light: '#FEF3C7',
  },

  // Danger/destructive - red
  danger: {
    default: '#EF4444',
    pressed: '#DC2626',
    light: '#FEE2E2',
  },

  // Success/positive - green
  success: {
    default: '#22C55E',
    pressed: '#16A34A',
    light: '#DCFCE7',
  },

  // Light mode palette
  light: {
    background: '#F5F5F5',
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    border: '#E5E5E5',
    borderStrong: '#D4D4D4',
    text: '#171717',
    textSecondary: '#525252',
    textTertiary: '#737373',
    overlay: 'rgba(0, 0, 0, 0.5)',
  },

  // Dark mode palette
  dark: {
    background: '#0A0A0A',
    surface: '#171717',
    surfaceElevated: '#262626',
    border: '#262626',
    borderStrong: '#404040',
    text: '#FAFAFA',
    textSecondary: '#A3A3A3',
    textTertiary: '#737373',
    overlay: 'rgba(0, 0, 0, 0.8)',
  },

  // Region colors for puzzle grid (high contrast for outdoor readability)
  regions: [
    '#3B82F6', // Blue
    '#22C55E', // Green
    '#F59E0B', // Amber
    '#EF4444', // Red
    '#8B5CF6', // Violet
    '#06B6D4', // Cyan
    '#EC4899', // Pink
    '#F97316', // Orange
  ],
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 48,
} as const;

export const sizing = {
  // Touch targets (Android Material Design minimum)
  touchTarget: 48,
  touchTargetPrimary: 56,

  // Icons
  iconSm: 16,
  iconMd: 20,
  iconLg: 24,
  iconXl: 32,

  // Border radius
  radiusSm: 6,
  radiusMd: 10,
  radiusLg: 12,
  radiusXl: 16,
  radiusFull: 9999,
} as const;

export const typography = {
  // Font sizes
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,

  // Font weights (NativeWind class names)
  normal: 'font-normal',
  medium: 'font-medium',
  semibold: 'font-semibold',
  bold: 'font-bold',
} as const;

export const zIndex = {
  base: 0,
  dropdown: 10,
  sticky: 20,
  modal: 30,
  popover: 40,
  toast: 50,
} as const;

// Helper to get color based on dark mode
export function getColor(isDark: boolean, lightKey: keyof typeof colors.light, darkKey?: keyof typeof colors.dark) {
  return isDark ? colors.dark[darkKey ?? lightKey as keyof typeof colors.dark] : colors.light[lightKey];
}

// Helper to get themed surface color
export function getSurface(isDark: boolean) {
  return isDark ? colors.dark.surface : colors.light.surface;
}

// Helper to get themed text color
export function getText(isDark: boolean, variant: 'primary' | 'secondary' | 'tertiary' = 'primary') {
  const key = variant === 'primary' ? 'text' : variant === 'secondary' ? 'textSecondary' : 'textTertiary';
  return isDark ? colors.dark[key] : colors.light[key];
}
