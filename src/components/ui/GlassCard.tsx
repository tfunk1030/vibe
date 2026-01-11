/**
 * GlassCard - Glassmorphism Container
 *
 * Frosted glass effect card for the Obsidian Arcade theme.
 * Uses expo-blur for iOS-optimized blur effects.
 */

import React from 'react';
import { View, ViewProps, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn } from 'react-native-reanimated';
import { obsidianDark, radius, shadows } from '@/lib/theme';

interface GlassCardProps extends ViewProps {
  children: React.ReactNode;
  /** Blur intensity (0-100) */
  intensity?: number;
  /** Whether to show brass accent border */
  brassAccent?: boolean;
  /** Whether to animate entry */
  animated?: boolean;
  /** Card padding */
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** Border radius size */
  rounded?: 'sm' | 'md' | 'lg' | 'xl';
}

const paddingValues = {
  none: 0,
  sm: 8,
  md: 16,
  lg: 24,
};

const radiusValues = {
  sm: radius.sm,
  md: radius.md,
  lg: radius.lg,
  xl: radius.xl,
};

export function GlassCard({
  children,
  intensity = 20,
  brassAccent = false,
  animated = true,
  padding = 'md',
  rounded = 'lg',
  style,
  ...props
}: GlassCardProps) {
  const borderRadius = radiusValues[rounded];
  const paddingValue = paddingValues[padding];

  const Container = animated ? Animated.View : View;
  const animatedProps = animated ? { entering: FadeIn.duration(300) } : {};

  return (
    <Container
      style={[
        styles.container,
        { borderRadius },
        brassAccent && styles.brassAccent,
        shadows.md,
        style,
      ]}
      {...animatedProps}
      {...props}
    >
      {/* Blur background */}
      <BlurView
        intensity={intensity}
        tint="dark"
        style={[StyleSheet.absoluteFill, { borderRadius }]}
      />

      {/* Gradient overlay for depth */}
      <LinearGradient
        colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.02)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[StyleSheet.absoluteFill, { borderRadius }]}
      />

      {/* Content */}
      <View style={[styles.content, { padding: paddingValue }]}>
        {children}
      </View>
    </Container>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: obsidianDark.border.default,
    backgroundColor: 'rgba(18, 18, 26, 0.6)',
  },
  brassAccent: {
    borderColor: obsidianDark.border.brass,
    borderWidth: 1.5,
  },
  content: {
    position: 'relative',
  },
});

/**
 * GlassCardHeader - Optional header section for GlassCard
 */
interface GlassCardHeaderProps {
  children: React.ReactNode;
}

export function GlassCardHeader({ children }: GlassCardHeaderProps) {
  return (
    <View style={headerStyles.container}>
      {children}
      <View style={headerStyles.divider} />
    </View>
  );
}

const headerStyles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  divider: {
    height: 1,
    backgroundColor: obsidianDark.border.subtle,
    marginTop: 12,
  },
});
