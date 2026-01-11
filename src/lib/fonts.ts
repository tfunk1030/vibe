/**
 * Font Loading & Typography System
 *
 * Obsidian Arcade Typography:
 * - Bebas Neue: Bold, condensed display font for headers
 * - JetBrains Mono: Technical precision for numbers/data
 * - DM Sans: Clean, modern body text
 */

import { useFonts } from 'expo-font';
import {
  BebasNeue_400Regular,
} from '@expo-google-fonts/bebas-neue';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_700Bold,
} from '@expo-google-fonts/jetbrains-mono';
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';
import { TextStyle } from 'react-native';

// ==========================================
// Font Loading Hook
// ==========================================

export const useAppFonts = () => {
  const [fontsLoaded, fontError] = useFonts({
    // Display font - Headers, titles, buttons
    'BebasNeue-Regular': BebasNeue_400Regular,

    // Mono font - Numbers, data, coordinates
    'JetBrainsMono-Regular': JetBrainsMono_400Regular,
    'JetBrainsMono-Medium': JetBrainsMono_500Medium,
    'JetBrainsMono-Bold': JetBrainsMono_700Bold,

    // Body font - UI text, descriptions
    'DMSans-Regular': DMSans_400Regular,
    'DMSans-Medium': DMSans_500Medium,
    'DMSans-Bold': DMSans_700Bold,
  });

  return { fontsLoaded, fontError };
};

// ==========================================
// Font Family Constants
// ==========================================

export const fontFamily = {
  // Display - Bebas Neue
  display: 'BebasNeue-Regular',

  // Mono - JetBrains Mono
  mono: 'JetBrainsMono-Regular',
  monoMedium: 'JetBrainsMono-Medium',
  monoBold: 'JetBrainsMono-Bold',

  // Body - DM Sans
  body: 'DMSans-Regular',
  bodyMedium: 'DMSans-Medium',
  bodyBold: 'DMSans-Bold',
} as const;

// ==========================================
// Typography Scale
// ==========================================

export const typography = {
  // Display typography (Bebas Neue)
  display: {
    hero: {
      fontFamily: fontFamily.display,
      fontSize: 48,
      letterSpacing: 4,
      lineHeight: 52,
    } as TextStyle,
    title: {
      fontFamily: fontFamily.display,
      fontSize: 32,
      letterSpacing: 2,
      lineHeight: 36,
    } as TextStyle,
    subtitle: {
      fontFamily: fontFamily.display,
      fontSize: 24,
      letterSpacing: 1,
      lineHeight: 28,
    } as TextStyle,
    button: {
      fontFamily: fontFamily.display,
      fontSize: 18,
      letterSpacing: 1.5,
      lineHeight: 22,
    } as TextStyle,
  },

  // Data typography (JetBrains Mono)
  data: {
    large: {
      fontFamily: fontFamily.monoMedium,
      fontSize: 24,
      letterSpacing: 0,
      lineHeight: 28,
    } as TextStyle,
    number: {
      fontFamily: fontFamily.monoMedium,
      fontSize: 20,
      letterSpacing: 0,
      lineHeight: 24,
    } as TextStyle,
    small: {
      fontFamily: fontFamily.mono,
      fontSize: 14,
      letterSpacing: 0,
      lineHeight: 18,
    } as TextStyle,
    pip: {
      fontFamily: fontFamily.monoBold,
      fontSize: 16,
      letterSpacing: 0,
      lineHeight: 20,
    } as TextStyle,
  },

  // Body typography (DM Sans)
  body: {
    large: {
      fontFamily: fontFamily.body,
      fontSize: 18,
      letterSpacing: 0,
      lineHeight: 26,
    } as TextStyle,
    base: {
      fontFamily: fontFamily.body,
      fontSize: 16,
      letterSpacing: 0,
      lineHeight: 24,
    } as TextStyle,
    small: {
      fontFamily: fontFamily.body,
      fontSize: 14,
      letterSpacing: 0,
      lineHeight: 20,
    } as TextStyle,
    caption: {
      fontFamily: fontFamily.bodyMedium,
      fontSize: 12,
      letterSpacing: 0.2,
      lineHeight: 16,
    } as TextStyle,
  },

  // UI typography (DM Sans)
  ui: {
    label: {
      fontFamily: fontFamily.bodyMedium,
      fontSize: 14,
      letterSpacing: 0.5,
      lineHeight: 18,
      textTransform: 'uppercase',
    } as TextStyle,
    badge: {
      fontFamily: fontFamily.bodyBold,
      fontSize: 11,
      letterSpacing: 0.5,
      lineHeight: 14,
      textTransform: 'uppercase',
    } as TextStyle,
  },
} as const;

// ==========================================
// Helper Functions
// ==========================================

/**
 * Get text style with color applied
 */
export const getTextStyle = (
  style: TextStyle,
  color: string
): TextStyle => ({
  ...style,
  color,
});

/**
 * Combine typography styles
 */
export const combineStyles = (...styles: TextStyle[]): TextStyle => {
  return Object.assign({}, ...styles);
};
