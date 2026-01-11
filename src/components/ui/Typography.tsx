/**
 * Typography Components - Obsidian Arcade
 *
 * Pre-styled text components using the theme typography system.
 * Use these instead of raw Text components for consistent styling.
 */

import React from 'react';
import { Text, TextProps, TextStyle } from 'react-native';
import { typography, fontFamily } from '@/lib/fonts';
import { obsidianDark, obsidianLight } from '@/lib/theme';
import { useColorScheme } from '@/lib/useColorScheme';

// ==========================================
// Base Props
// ==========================================

interface TypographyProps extends TextProps {
  children: React.ReactNode;
  color?: string;
  center?: boolean;
  className?: string;
}

// ==========================================
// Hook for theme colors
// ==========================================

const useThemeColors = () => {
  const colorScheme = useColorScheme();
  return colorScheme === 'dark' ? obsidianDark : obsidianLight;
};

// ==========================================
// Display Typography (Bebas Neue)
// ==========================================

/** Hero text - 48px, bold, architectural */
export const HeroText = ({ children, color, center, style, ...props }: TypographyProps) => {
  const theme = useThemeColors();
  return (
    <Text
      style={[
        typography.display.hero,
        { color: color ?? theme.text.primary },
        center && { textAlign: 'center' },
        style,
      ]}
      {...props}
    >
      {children}
    </Text>
  );
};

/** Title text - 32px, condensed headers */
export const TitleText = ({ children, color, center, style, ...props }: TypographyProps) => {
  const theme = useThemeColors();
  return (
    <Text
      style={[
        typography.display.title,
        { color: color ?? theme.text.primary },
        center && { textAlign: 'center' },
        style,
      ]}
      {...props}
    >
      {children}
    </Text>
  );
};

/** Subtitle text - 24px, section headers */
export const SubtitleText = ({ children, color, center, style, ...props }: TypographyProps) => {
  const theme = useThemeColors();
  return (
    <Text
      style={[
        typography.display.subtitle,
        { color: color ?? theme.text.primary },
        center && { textAlign: 'center' },
        style,
      ]}
      {...props}
    >
      {children}
    </Text>
  );
};

/** Button text - 18px, for action buttons */
export const ButtonText = ({ children, color, center, style, ...props }: TypographyProps) => {
  const theme = useThemeColors();
  return (
    <Text
      style={[
        typography.display.button,
        { color: color ?? theme.text.primary },
        center && { textAlign: 'center' },
        style,
      ]}
      {...props}
    >
      {children}
    </Text>
  );
};

// ==========================================
// Data Typography (JetBrains Mono)
// ==========================================

/** Large number display - 24px mono */
export const DataLarge = ({ children, color, center, style, ...props }: TypographyProps) => {
  const theme = useThemeColors();
  return (
    <Text
      style={[
        typography.data.large,
        { color: color ?? theme.text.primary },
        center && { textAlign: 'center' },
        style,
      ]}
      {...props}
    >
      {children}
    </Text>
  );
};

/** Number display - 20px mono, for scores, counts */
export const DataNumber = ({ children, color, center, style, ...props }: TypographyProps) => {
  const theme = useThemeColors();
  return (
    <Text
      style={[
        typography.data.number,
        { color: color ?? theme.text.primary },
        center && { textAlign: 'center' },
        style,
      ]}
      {...props}
    >
      {children}
    </Text>
  );
};

/** Small data - 14px mono, for coordinates, IDs */
export const DataSmall = ({ children, color, center, style, ...props }: TypographyProps) => {
  const theme = useThemeColors();
  return (
    <Text
      style={[
        typography.data.small,
        { color: color ?? theme.text.muted },
        center && { textAlign: 'center' },
        style,
      ]}
      {...props}
    >
      {children}
    </Text>
  );
};

/** Pip number - 16px mono bold, for domino pips */
export const PipText = ({ children, color, center, style, ...props }: TypographyProps) => {
  const theme = useThemeColors();
  return (
    <Text
      style={[
        typography.data.pip,
        { color: color ?? theme.text.primary },
        center && { textAlign: 'center' },
        style,
      ]}
      {...props}
    >
      {children}
    </Text>
  );
};

// ==========================================
// Body Typography (DM Sans)
// ==========================================

/** Large body text - 18px, for important descriptions */
export const BodyLarge = ({ children, color, center, style, ...props }: TypographyProps) => {
  const theme = useThemeColors();
  return (
    <Text
      style={[
        typography.body.large,
        { color: color ?? theme.text.secondary },
        center && { textAlign: 'center' },
        style,
      ]}
      {...props}
    >
      {children}
    </Text>
  );
};

/** Base body text - 16px, default reading text */
export const BodyText = ({ children, color, center, style, ...props }: TypographyProps) => {
  const theme = useThemeColors();
  return (
    <Text
      style={[
        typography.body.base,
        { color: color ?? theme.text.secondary },
        center && { textAlign: 'center' },
        style,
      ]}
      {...props}
    >
      {children}
    </Text>
  );
};

/** Small body text - 14px, for secondary content */
export const BodySmall = ({ children, color, center, style, ...props }: TypographyProps) => {
  const theme = useThemeColors();
  return (
    <Text
      style={[
        typography.body.small,
        { color: color ?? theme.text.secondary },
        center && { textAlign: 'center' },
        style,
      ]}
      {...props}
    >
      {children}
    </Text>
  );
};

/** Caption text - 12px, for timestamps, metadata */
export const Caption = ({ children, color, center, style, ...props }: TypographyProps) => {
  const theme = useThemeColors();
  return (
    <Text
      style={[
        typography.body.caption,
        { color: color ?? theme.text.muted },
        center && { textAlign: 'center' },
        style,
      ]}
      {...props}
    >
      {children}
    </Text>
  );
};

// ==========================================
// UI Typography (DM Sans)
// ==========================================

/** Label text - 14px uppercase, for form labels */
export const Label = ({ children, color, center, style, ...props }: TypographyProps) => {
  const theme = useThemeColors();
  return (
    <Text
      style={[
        typography.ui.label,
        { color: color ?? theme.text.muted },
        center && { textAlign: 'center' },
        style,
      ]}
      {...props}
    >
      {children}
    </Text>
  );
};

/** Badge text - 11px uppercase bold, for status badges */
export const BadgeText = ({ children, color, center, style, ...props }: TypographyProps) => {
  const theme = useThemeColors();
  return (
    <Text
      style={[
        typography.ui.badge,
        { color: color ?? theme.text.primary },
        center && { textAlign: 'center' },
        style,
      ]}
      {...props}
    >
      {children}
    </Text>
  );
};

// ==========================================
// Accent Text (with glow effect styling)
// ==========================================

interface AccentTextProps extends TypographyProps {
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'cyan' | 'brass';
}

/** Accent colored text - uses theme accent colors */
export const AccentText = ({
  children,
  variant = 'primary',
  center,
  style,
  ...props
}: AccentTextProps) => {
  const theme = useThemeColors();

  const accentColors: Record<string, string> = {
    primary: theme.accent.primary,
    success: theme.accent.success,
    warning: theme.accent.warning,
    danger: theme.accent.danger,
    cyan: theme.accent.cyan,
    brass: theme.accent.brass,
  };

  return (
    <Text
      style={[
        typography.display.subtitle,
        { color: accentColors[variant] },
        center && { textAlign: 'center' },
        style,
      ]}
      {...props}
    >
      {children}
    </Text>
  );
};
